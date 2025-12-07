import { createContext, useContext, useEffect, useState } from "react";

const DarkModeContext = createContext();

export function DarkModeProvider({ children }) {
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Check localStorage for saved preference
        const saved = localStorage.getItem("darkMode");
        return saved ? JSON.parse(saved) : false;
    });

    useEffect(() => {
        // Apply dark class to document root
        if (isDarkMode) {
            document.documentElement.classList.add("dark");
            console.log("Dark mode enabled");
        } else {
            document.documentElement.classList.remove("dark");
            console.log("Dark mode disabled");
        }

        // Save preference to localStorage
        localStorage.setItem("darkMode", JSON.stringify(isDarkMode));
    }, [isDarkMode]);

    const toggleDarkMode = () => {
        console.log("Toggling dark mode from:", isDarkMode, "to:", !isDarkMode);
        setIsDarkMode((prev) => !prev);
    };

    return (
        <DarkModeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
            {children}
        </DarkModeContext.Provider>
    );
}

export function useDarkMode() {
    const context = useContext(DarkModeContext);
    if (context === undefined) {
        throw new Error("useDarkMode must be used within a DarkModeProvider");
    }
    return context;
}
