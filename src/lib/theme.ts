import { DarkTheme, type Theme } from "expo-router"

export const colors = {
    bg: "#070B0A",
    surface: "#0F1614",
    surfaceAlt: "#151E1C",
    surfaceHigh: "#1C2826",
    border: "#22312E",
    // Main color.
    primary: "#2c9889",
    primaryStrong: "#2A9585",
    primarySoft: "rgba(53,183,165,0.14)",
    /** Text/icons drawn on top of `primary`. */
    onPrimary: "#04201C",
    text: "#E8F3F1",
    textMuted: "#93AAA6",
    textFaint: "#5B6F6B",
    // Chart/series colors — validated as a pair on the dark surface (incl. color-vision deficiency).
    income: "#1AA3B3",
    expense: "#D9772B",
    // Amounts rendered as text: green for money in, red for money out (always paired with +/− or arrows).
    incomeText: "#4ADE80",
    expenseText: "#F87171",
    incomeSoft: "rgba(74,222,128,0.14)",
    expenseSoft: "rgba(248,113,113,0.14)",
    danger: "#EF5350",
    dangerSoft: "rgba(239,83,80,0.14)",
    overlay: "rgba(0,0,0,0.72)",
}

export const accountColors = [
    "#2A9585",
    "#4FD1C5",
    "#3B9EDB",
    "#22C55E",
    "#8B9DF7",
    "#64748B",
    "#E2B33C",
]

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 }
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }

export const navTheme: Theme = {
    ...DarkTheme,
    colors: {
        ...DarkTheme.colors,
        primary: colors.primary,
        background: colors.bg,
        card: colors.bg,
        text: colors.text,
        border: colors.border,
        notification: colors.primary,
    },
}
