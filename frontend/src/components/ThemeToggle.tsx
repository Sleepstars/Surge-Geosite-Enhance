import React from "react"
import { Moon, Sun, SunMoon } from "lucide-react"
import { Button } from "./ui/Button"
import { useTheme } from "@/hooks/useTheme"
import type { ThemePreference } from "@/hooks/useTheme"

const modeOrder: ThemePreference[] = ["system", "light", "dark"]
const modeLabels: Record<ThemePreference, string> = {
  system: "自动",
  light: "浅色",
  dark: "深色",
}

export const ThemeToggle: React.FC = () => {
  const { preference, resolved, setPreference } = useTheme()

  const handleToggle = () => {
    const currentIndex = modeOrder.indexOf(preference)
    const nextMode = modeOrder[(currentIndex + 1) % modeOrder.length]!
    setPreference(nextMode)
  }

  const renderIcon = () => {
    if (preference === "system") {
      return resolved === "dark" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )
    }

    if (preference === "dark") {
      return <Moon className="h-4 w-4" />
    }

    return <Sun className="h-4 w-4" />
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      className="flex items-center gap-2"
      aria-label={`主题：${modeLabels[preference]}`}
      title={`主题：${modeLabels[preference]}（点击切换）`}
    >
      <span className="relative flex items-center">
        {renderIcon()}
        {preference === "system" && (
          <SunMoon className="absolute -bottom-2 -right-2 h-3 w-3 text-primary" />
        )}
      </span>
      <span className="hidden sm:inline">{modeLabels[preference]}</span>
    </Button>
  )
}
