import { ChatOllama } from '@langchain/ollama'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import wxFlows from '@wxflows/sdk/langchain'
import { END, START, StateGraph, MessagesAnnotation, MemorySaver } from '@langchain/langgraph'
import SYSTEM_MESSAGE from '@/constants/systemMessage'
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, trimMessages } from '@langchain/core/messages'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'

const toolClient = new wxFlows({
    apikey: process.env.WATSON_API_KEY || "",
    endpoint: process.env.WXFLOWS_END_POINT || ""
})

const trimmer = trimMessages({
    maxTokens: 10,
    strategy: 'last',
    tokenCounter: msg => msg.length,
    includeSystem: true,
    allowPartial: false,
    startOn: 'human'
})

const tools = await toolClient.lcTools;
const toolNode = new ToolNode(tools)


function shouldContinue(state: typeof MessagesAnnotation.State) {
    const messages = state.messages;

    const lastMessages = messages[messages.length - 1] as AIMessage

    if (lastMessages.tool_calls?.length) {
        return "tools"
    }

    if (lastMessages.content && lastMessages._getType() === "tool") {
        return "agent"
    }

    return END;
}


const initializeMode = () => {
    const model = new ChatOllama({
        model: 'llama3.2',
        temperature: .5,
        streaming: true,
        callbacks: [
            {
                handleLLMStart: async () => {
                    console.log("Starting LLM call")
                },
                handleLLMEnd: async (output) => {
                    console.log("END LLM call")
                    const usage = output.llmOutput?.usage;
                    if (usage) {
                        
                    }
                }
            }
        ]
    }).bindTools(tools)

    return model
}

export const createWorkflow = async () => {
    const model = initializeMode()
    const stateGraph = new StateGraph(MessagesAnnotation);
    stateGraph.addNode('agent', async (state) => {

        const systemContent = SYSTEM_MESSAGE;

        const prompTemplate = ChatPromptTemplate.fromMessages([
            new SystemMessage(systemContent, {
                cache_control: { type: "ephemeral" },
            }),
            new MessagesPlaceholder("messages")
        ])

        const trimMessages = await trimmer.invoke(state.messages)
        const prompt = await prompTemplate.invoke({ messages: trimMessages })
        const response = await model.invoke(prompt)
        return { messages: [response] }
        
    }).addNode('tools', toolNode)
        .addEdge(START, "agent")
        .addConditionalEdges("agent", shouldContinue)
        .addEdge('tools', "agent");
    
    return stateGraph;
}


function addCachingHeaders(messages: BaseMessage[]): BaseMessage[]{

    if (!messages.length) return messages;

    const cachedMessages = [...messages]

    const addCache = (message: BaseMessage) => {
        message.content = [
            {
                type: "text",
                text: message.content as string,
                cache_control: {type: "ephemeral"}
            }
        ]
    }
    addCache(cachedMessages.at(-1)!);

    let humanCount = 0;

    for (let i = cachedMessages.length - 1; i >= 0; i--){
        if (cachedMessages[i] instanceof HumanMessage) {
            humanCount++;
            if (humanCount === 2) {
                addCache(cachedMessages[i])
                break;
            }
        }
    }
    return cachedMessages;
}

export async function submitQuestion(messages: BaseMessage[], chatId: string) {
    const cachedMessages = addCachingHeaders(messages)
    const workflow = await createWorkflow();

    const checkpointer = new MemorySaver();

    const app = workflow.compile({ checkpointer });
    const stream = await app.streamEvents(
      {
            messages: cachedMessages
          
      },
        {
            version: "v2",
            configurable: {
                thread_id: chatId
            },
            streamMode: 'messages',
            runId: chatId
        }
    )
    return stream;
}