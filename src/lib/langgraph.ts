import { ChatOllama } from '@langchain/ollama'
import { ToolNode } from '@langchain/langgraph/prebuilt'
import wxFlows from '@wxflows/sdk/langchain'

const toolClient = new wxFlows({

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