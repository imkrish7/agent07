import { ChatOllama } from '@langchain/ollama'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import wxFlows from '@wxflows/sdk/langchain'
import { END, START, StateGraph, MessagesAnnotation } from '@langchain/langgraph'
import SYSTEM_MESSAGE from '@/constants/systemMessage'
import { SystemMessage } from '@langchain/core/messages'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'

const toolClient = new wxFlows({
    apikey: process.env.WATSON_API_KEY || "",
    endpoint: process.env.WXFLOWS_END_POINT || ""
})

const tools = await toolClient.lcTools;
const toolNode = new ToolNode(tools)

const initializeMode = () => {
    const model = new ChatOllama({
        model: 'mistral',
        temperature: 0,
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
    }).bindTools([tools])

    return model
}

const createWorkflow = async () => {
    const model = initializeMode()
    const stateGraph = new StateGraph(MessagesAnnotation);
    stateGraph.addNode('agent', async (state) => {

        const systemContent = SYSTEM_MESSAGE;

        const prompTemplate = ChatPromptTemplate.fromMessages([
            new SystemMessage(systemContent, {
                cache_control: {type: "ephemeral"},
            }),
            new MessagesPlaceholder("messages")
        ])
        
    })

}