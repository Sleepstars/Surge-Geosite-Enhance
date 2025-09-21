import { Header } from './components/Header'
import { Footer } from './components/Footer'
import { IntroSection } from './components/IntroSection'
import { GeositeTree } from './components/geosite/GeositeTree'
import { GeositeRuleList } from './components/geosite/GeositeRuleList'
import { GeoipNameList } from './components/geoip/GeoipNameList'
import { GeoipCidrList } from './components/geoip/GeoipCidrList'
import { SearchPanel } from './components/search/SearchPanel'
import { useAppStore } from './stores/useAppStore'

function App() {
  const { activeDataset } = useAppStore()

  return (
    <div className="min-h-screen flex flex-col gradient-bg">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 space-y-8">
        <IntroSection />
        
        {activeDataset === 'geosite' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <GeositeTree />
            <GeositeRuleList />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <GeoipNameList />
            <GeoipCidrList />
          </div>
        )}

        <SearchPanel />
      </main>
      
      <Footer />
    </div>
  )
}

export default App
