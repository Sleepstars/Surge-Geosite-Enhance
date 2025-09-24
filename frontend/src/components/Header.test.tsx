import { render, screen } from '@testing-library/react'
import { Header } from '../components/Header'

describe('Header', () => {
  it('renders the header with logo and title', () => {
    render(<Header />)

    expect(screen.getByText('Surge Geosite Explorer')).toBeInTheDocument()
    expect(screen.getByAltText('Surge Geosite Enhance logo')).toBeInTheDocument()
    expect(screen.getByText('直观浏览与域名搜索 GeoSite / GeoIP 规则')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<Header />)

    expect(screen.getByText('博客文章')).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
  })
})