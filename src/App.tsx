import {Component, createEffect, createResource, createSignal, Index} from 'solid-js'
import {parse} from 'yaml'
import tavernImg from './assets/tavern.jpg'
import woodImg from './assets/wood.jpg'

interface RecipeFile {
    name: string;
    download_url: string;
}

interface Recipe {
    info: Info;
    materials?: string[];
    ingredients: { [key: string]: number | string };
    seasonings: string[];
    steps: { [key: string]: (NormalStep | GotoStep)[] };
}

interface Info {
    name: string;
    description: string;
    author: string;
    image?: string;
}

interface NormalStep {
    text: string;
    from?: string[];
    ingredients?: string[];
    minutes?: number;
}

interface GotoStep {
    goto: string;
}

const App: Component = () => {
    let [recipe_files] = createResource(
        () => fetch('https://api.github.com/repos/joelverm/recipequest-repo/contents/')
            .then(res => res.json() as Promise<RecipeFile[]>)
            .then(files => files.filter(file => file.name.endsWith('.yaml')))
    )
    let [selectedRecipe, setSelectedRecipe] = createSignal<number | undefined>()

    return (
        <div class="h-full w-full" style={{'background-image': `url(${tavernImg})`}}>
            <BookStack recipes={recipe_files() ?? []} select={(i) => setSelectedRecipe(i)}/>
            <SingleBook recipe={recipe_files()?.[selectedRecipe() as number]} index={selectedRecipe()}
                        back={() => setSelectedRecipe(undefined)}/>
        </div>
    )
}

function pseudoRandom(seed: number, size: number) {
    let x = Math.sin(seed) * size
    return x - Math.floor(x)
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

const colours: [string, string][] = [
    ['#733e39', '#3e2731'],
    ['#3e8948', '#265c42'],
    ['#d77643', '#be4a2f'],
    ['#0099db', '#124e89'],
    ['#e43b44', '#a22633'],
]

const getColour = (index: number) => colours[Math.floor(pseudoRandom(index + 15, 13000) * colours.length)]

const BookStack: Component<{ recipes: RecipeFile[], select: (index: number) => void }> = (props) => {
    return (
        <div class="flex flex-col h-full w-full overflow-y-auto">
            <div class="flex-1"></div>
            <div class="flex flex-col max-w-screen-sm w-full m-auto px-4">
                <Index each={props.recipes}>
                    {(recipe, index) => {
                        const size = 20
                        const margin = pseudoRandom(index + 11, 10000) * size
                        const colour = getColour(index)
                        return (<button
                            class="rounded p-1.5 block"
                            style={{
                                'margin-left': margin + '%',
                                'margin-right': size - margin + '%',
                                'background': `linear-gradient(180deg, ${colour[0]} 20%, ${colour[1]} 80%)`,
                            }}
                            onClick={() => props.select(index)}>
                            <div style={{'font-family': '"Merriweather", serif'}}
                                 class="font-medium text-xl py-0.5 px-4 inline-block m-auto bg-amber-100 border-2 rounded-full border-yellow-500"
                            >{capitalize(recipe().name.replace('.yaml', ''))}</div>
                        </button>)
                    }}
                </Index>
            </div>
            <img src={woodImg} alt="wood" class="max-h-20 object-cover"/>
        </div>
    )
}

const SingleBook: Component<{ recipe?: RecipeFile, index?: number, back: () => void }> = (props) => {
    let [lastRecipe] = createResource(() => props.recipe,
        (recipe) => fetch(recipe.download_url)
            .then(res => res.text())
            .then(text => parse(text) as Recipe)
    )
    let recipe = () => props.recipe == undefined ? undefined : lastRecipe()
    let [colour, setColour] = createSignal(getColour(0))
    createEffect(() => {
        if (props.index != undefined) {
            setColour(getColour(props.index))
        }
    })
    return (
        <div
            class="absolute h-dvh w-dvw top-0 transition-[left] duration-500 cursor-pointer"
            style={{
                'left': recipe() == undefined ? '-101dvw' : '-5px',
            }}
            onClick={props.back}
        >
            <button class="hidden" onClick={props.back}>Back</button>
            <div
                class="relative h-[80%] w-[600px] max-w-[95dvw] rounded top-[50%] left-0 translate-y-[-50%] py-4 pe-4 cursor-default"
                style={{
                    'background': `linear-gradient(225deg, ${colour()[0]} 20%, ${colour()[1]} 80%)`,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div class="w-full h-full bg-amber-100 rounded p-1 ps-3"
                     style={{'font-family': '"Merriweather", serif'}}>
                    <h1>{recipe()?.info.name}</h1>
                </div>
            </div>
        </div>
    )
}

export default App
