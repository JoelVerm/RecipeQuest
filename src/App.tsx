import {Component, createEffect, createResource, createSignal, For, Index, JSX, Show} from 'solid-js'
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
    steps: { [key: string]: Step[] };
}

type Step = NormalStep | GotoStep

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

const isNormalStep = (step: Step | undefined): step is NormalStep => (step as NormalStep | undefined)?.text !== undefined

interface GotoStep {
    goto: string;
}

const isGotoStep = (step: Step | undefined): step is GotoStep => (step as GotoStep | undefined)?.goto !== undefined

const App: Component = () => {
    const [recipe_files] = createResource(
        () => fetch('https://api.github.com/repos/joelverm/recipequest-repo/contents/')
            .then(res => res.json() as Promise<RecipeFile[]>)
            .then(files => files.filter(file => file.name.endsWith('.yaml')))
    )
    const [selectedRecipe, _setSelectedRecipe] = createSignal<number | undefined>()
    createEffect(() => {
        let files = recipe_files()
        if (files != undefined) {
            let hash = decodeURI(window.location.hash)
            if (hash.length > 1) {
                let index = files.findIndex(file => file.name === hash.slice(1) + '.yaml')
                if (index >= 0) {
                    setSelectedRecipe(index)
                }
            }
        }
    })
    const setSelectedRecipe = (index: number | undefined) => {
        window.location.hash = recipe_files()?.[index as number]?.name.replace('.yaml', '') ?? ''
        _setSelectedRecipe(index)
    }

    return (
        <div class="h-full w-full" style={{'background-image': `url(${tavernImg})`, 'background-position': 'center'}}>
            <BookStack recipes={recipe_files() ?? []} select={setSelectedRecipe}/>
            <SingleBook recipe={recipe_files()?.[selectedRecipe() as number]} index={selectedRecipe()}
                        back={() => setSelectedRecipe(undefined)}/>
        </div>
    )
}

function pseudoRandom(seed: number, size: number) {
    const x = Math.sin(seed) * size
    return x - Math.floor(x)
}

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1)

const colours: [string, string][] = [
    ['#733e39', '#3e2731'],
    ['#3e8948', '#265c42'],
    ['#d77643', '#be4a2f'],
    ['#0099db', '#124e89'],
    ['#e43b44', '#a22633'],
    ['#feae34', '#f77622'],
    ['#b55088', '#68386c'],
]

const getColour = (index: number) => colours[Math.floor(pseudoRandom(index + 14, 17000) * colours.length)]

const BookStack: Component<{ recipes: RecipeFile[], select: (index: number) => void }> = (props) => {
    return (
        <div class="flex flex-col h-full w-full overflow-y-auto">
            <div class="flex-1"></div>
            <div class="flex flex-col max-w-screen-sm w-full m-auto px-4">
                <Index each={props.recipes}>
                    {(recipe, index) => {
                        const size = 20
                        const margin = pseudoRandom(index + 9, 10000) * size
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

interface TimeFrameTree {
    name: string
    root: Step[]
    children: TimeFrameTree[]
}

interface TimeFrameStep {
    timeLine: string
    step?: NormalStep
}

type TimeFrame = TimeFrameStep[]

const createTimeFrames = (recipe: Recipe): TimeFrame[] => {
    const createTree = (name: string, steps: Step[]): TimeFrameTree | undefined => {
        const step = steps[0]
        if (!isNormalStep(step)) {
            console.error(`Step ${name} does not start with a normal step`)
            return undefined
        }
        let fromRefChildren = step.from ?? []
        let gotoRefChildren = Object.entries(recipe.steps).filter(
            ([_key, value]) => isGotoStep(value.at(-1)) && (value.at(-1) as GotoStep).goto === name)
        if (gotoRefChildren.map(([key, _value]) => key).toSorted().join('___') !== fromRefChildren.toSorted().join('___')) {
            console.error(`Step ${name} has mismatching goto and from references`)
            return undefined
        }
        return {
            name,
            root: steps,
            children: gotoRefChildren.map(([key, value]) => createTree(key, value)).filter((x): x is TimeFrameTree => x !== undefined)
        }
    }
    const walkTree = (trees: TimeFrameTree[]) => {
        const reversedTimeFrames: TimeFrameStep[][] = [[]]
        for (const tree of trees) {
            let currentTime = 0
            for (const step of tree.root.toReversed()) {
                if (isNormalStep(step)) {
                    const oldTime = currentTime
                    currentTime += (step.minutes ?? 0) + 1
                    for (let i = oldTime + 1; i < currentTime; i++) {
                        if (reversedTimeFrames[i] === undefined) {
                            reversedTimeFrames[i] = []
                        }
                        reversedTimeFrames[i].push({
                            timeLine: tree.name
                        })
                    }
                    if (reversedTimeFrames[currentTime] === undefined) {
                        reversedTimeFrames[currentTime] = []
                    }
                    reversedTimeFrames[currentTime].push({
                        timeLine: tree.name,
                        step: step
                    })
                }
            }
            for (const v of walkTree(tree.children).entries()) {
                const i = v[0]
                const item = v[1]
                if (reversedTimeFrames[currentTime + i] === undefined) {
                    reversedTimeFrames[currentTime + i] = []
                }
                reversedTimeFrames[currentTime + i].push(...item)
            }
        }
        return reversedTimeFrames
    }
    const tree = Object.entries(recipe.steps)
        .filter(([_key, value]) => isNormalStep(value.at(-1)))
        .map(([key, value]) => createTree(key, value))
        .filter((x): x is TimeFrameTree => x !== undefined)
    const reversedTimeFrames = walkTree(tree)
    return reversedTimeFrames
        .toReversed()
        .filter((x) => x.some(i => i.step != undefined))
}

const SingleBook: Component<{ recipe?: RecipeFile, index?: number, back: () => void }> = (props) => {
    const [recipe] = createResource(() => props.recipe,
        (recipe) => fetch(recipe.download_url)
            .then(res => res.text())
            .then(text => parse(text) as Recipe)
    )
    const recipeTimeFrames = () => recipe() == undefined ? [] : createTimeFrames(recipe()!)
    const [colour, setColour] = createSignal(getColour(0))
    const [selectedPage, setSelectedPage] = createSignal(0)
    createEffect(() => {
        if (props.index != undefined) {
            setSelectedPage(0)
            setColour(getColour(props.index))
        }
    })
    return (
        <div
            class="absolute h-dvh w-dvw top-0 transition-[left] duration-500 cursor-pointer"
            style={{
                'left': props.recipe == undefined ? '-101dvw' : '-5px',
            }}
            onClick={props.back}
        >
            <button class="hidden" onClick={props.back}>Back</button>
            <div
                class="relative h-[80%] w-[600px] max-w-[95dvw] rounded top-[50%] left-0 translate-y-[-50%] py-4 pe-4 grid grid-rows-1 grid-cols-1 cursor-default"
                style={{
                    'background': `linear-gradient(225deg, ${colour()[0]} 20%, ${colour()[1]} 80%)`,
                    'box-shadow': '0px 0px 8px 2px #3b2f0c70'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <BookPage page={0} selected={selectedPage()} forward={() => setSelectedPage(1)} collapse={true}>
                    <h1 class="text-xl">{recipe()?.info.name}</h1>
                    <p>{recipe()?.info.description}<br/>- {recipe()?.info.author}</p>
                    <Show when={recipe()?.info.image}>
                        {image => <img src={image()} alt="recipe" class="w-full h-40 object-cover"/>}
                    </Show>
                    <Show when={recipe()?.materials?.length ?? 0 > 0}>
                        <h2 class="text-lg">Materials:</h2>
                        <p>{recipe()?.materials?.join(', ')}</p>
                    </Show>
                    <h2 class="text-lg">Ingredients:</h2>
                    <ul>
                        <For each={Object.entries(recipe()?.ingredients ?? {})}
                             fallback={<li>None</li>}>
                            {([ingredient, amount]) => (
                                <li>{ingredient}: {amount}</li>
                            )}
                        </For>
                    </ul>
                    <Show when={recipe()?.seasonings.length ?? 0 > 0}>
                        <h2 class="text-lg">Seasonings:</h2>
                        <p>{recipe()?.seasonings.join(', ')}</p>
                    </Show>
                </BookPage>
                <Index each={recipeTimeFrames()}>
                    {(timeFrame, index) => (
                        <BookPage page={index + 1} selected={selectedPage()} back={() => setSelectedPage(index)}
                                  forward={() => setSelectedPage(index + 2)}>
                            <Index each={timeFrame()}>
                                {(step) => (
                                    <div class="border-b border-black pb-1">
                                        <h1 class="text-xl">{capitalize(step().timeLine)} {step().step ? `- ${capitalize(step().step!.text)}` : ''}</h1>
                                        <Show when={step().step}>
                                            {step =>
                                                <>
                                                    <p>{[...step().from ?? [], ...step().ingredients ?? []].join(', ')}</p>
                                                    <Show when={step().minutes ?? 0 > 0} fallback={<p>&nbsp;</p>}>
                                                        <p>Takes {step().minutes} minutes</p>
                                                    </Show>
                                                </>
                                            }
                                        </Show>
                                    </div>
                                )}
                            </Index>
                        </BookPage>
                    )}
                </Index>
                <BookPage page={recipeTimeFrames().length + 1} selected={selectedPage()}
                          back={() => setSelectedPage(recipeTimeFrames().length - 1)}>
                    <h1 class="text-xl">Done!</h1>
                </BookPage>
            </div>
        </div>
    )
}

const BookPage: Component<{
    page: number,
    selected: number,
    back?: () => void,
    forward?: () => void,
    collapse?: boolean,
    children: JSX.Element
}> = (props) => {
    const on = () => props.selected <= props.page
    return (
        <div
            class="w-full h-full row-start-1 row-end-1 col-start-1 col-end-1 flex flex-col gap-2 rounded p-3 ps-5 duration-500 gradient"
            style={{
                'font-family': '"Merriweather", serif',
                'z-index': 1000 - props.page,
                'margin-left': (on() ? 0 : -100) + '%',
                '--g-angle': on() ? '225deg' : '270deg',
                '--g-from-color': '#fef3c7',
                '--g-to-color': '#bb9f5c',
                '--g-from-percent': '10%',
                '--g-to-percent': on() ? '90%' : '30%',
                '--transition': 'margin-left 0.5s, --anim-color 0.5s',
                '--anim-color': on() ? '#3b2f0c30' : '#3b2f0caa',
                'box-shadow': '0px 0px 4px 0.5px var(--anim-color)',
            }}>
            <div class="flex-1 overflow-y-auto">
                <div class={'grid h-min gap-2 ' + (props.collapse ? '' : 'auto-rows-fr')}>
                    {props.children}
                </div>
            </div>
            <div class="flex flex-row">
                <Show when={props.back} fallback={<div class="flex-1"></div>}>
                    {back => <button class="text-4xl flex-1 text-left" onClick={back()}>⇐</button>}
                </Show>
                <Show when={props.forward} fallback={<div class="flex-1"></div>}>
                    {forward => <button class="text-4xl flex-1 text-right" onClick={forward()}>⇒</button>}
                </Show>
            </div>
        </div>
    )
}

export default App
