import React from "react"
import { BookOpen, Github } from "lucide-react"
import logo from "../../../docs/img/logo.png"
import { Button } from "./ui/Button"
import { ThemeToggle } from "./ThemeToggle"

export const Header: React.FC = () => {
  return (
    <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={logo}
              alt="Surge Geosite Enhance logo"
              className="h-10 w-10 rounded-md border border-border/40 bg-background object-contain p-1"
            />
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Surge Geosite Explorer
              </h1>
              <p className="text-sm text-muted-foreground">
                直观浏览与域名搜索 GeoSite / GeoIP 规则
              </p>
            </div>
          </div>
          
          <nav className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="https://blog.sleepstars.net/geosite-enhance"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <BookOpen className="h-4 w-4" />
                博客文章
              </Button>
            </a>
            <a
              href="https://github.com/Sleepstars/Surge-Geosite-Enhance"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="ghost"
                size="sm"
                className="flex items-center gap-2"
              >
                <Github className="h-4 w-4" />
                GitHub
              </Button>
            </a>
          </nav>
        </div>
      </div>
    </header>
  )
}
