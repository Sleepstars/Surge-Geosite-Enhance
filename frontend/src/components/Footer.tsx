import React from 'react'

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border/50 bg-background/80 backdrop-blur-sm mt-auto">
      <div className="container mx-auto px-4 py-6">
        <p className="text-center text-sm text-muted-foreground">
          数据源通过 KV / R2 自动同步，页面调用 Worker API 实时获取最新规则。
          建议配合 Surge 等客户端交叉验证。
        </p>
      </div>
    </footer>
  )
}
