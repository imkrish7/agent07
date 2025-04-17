"use client"
import Header from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import {  NavigationProvider } from "@/lib/NavigationProvider";
import { Authenticated } from "convex/react";


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
   
  return (
    <NavigationProvider>
        <div className="flex h-screen">
            <Authenticated>
                <Sidebar />
            </Authenticated>
            <div className="flex-1 flex flex-col min-w-0">
                <Header />
                <main>
                    {children}
                </main>
            </div>
        </div>
    </NavigationProvider>
  );
}
