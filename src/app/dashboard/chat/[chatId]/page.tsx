import React from 'react'
import { Id } from '../../../../../convex/_generated/dataModel'
import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getConvexClient } from '@/lib/convext';

interface ChatPageProps {
    params: Promise<{
        chatId: Id<"chats">;
    }>
}

const ChatPage = async ({params}: ChatPageProps) => {
    const { chatId } = await params;
    const {userId} = await auth()

    if(!userId){
        redirect('/')
    }

    const convex = getConvexClient()
    // const initialMessages = 
  return (
    <div>{chatId}</div>
  )
}

export default ChatPage