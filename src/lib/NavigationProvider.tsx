"use client"

import { createContext, useState } from "react"

interface NavigationContextType {
    isMobileNavOpen: boolean,
    setIsMobileNavOpen: (open:boolean)=> void,
    closeMobileNav: ()=> void
}

const initialValue = {
    isMobileNavOpen: false,
    setIsMobileNavOpen: ()=> {},
    closeMobileNav: ()=> {}
}


export const NavigationContext = createContext<NavigationContextType>(initialValue)

export function NavigationProvider(
    {children}: {
        children: React.ReactNode
    }
){
    const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

    const closeMobileNav = ()=> setIsMobileNavOpen(false)

    return <NavigationContext value={{isMobileNavOpen, setIsMobileNavOpen, closeMobileNav}}>
        {children}
    </NavigationContext>
}