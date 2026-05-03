import { Routes, Route } from 'react-router-dom';
import { NavRail, TopNav } from './components/NavRail';
import { ShortcutsModal } from './components/ShortcutsModal';
import { FloatingChat } from './components/FloatingChat';
import { ThemeProvider } from './lib/theme';
import Overview from './acts/Overview';
import Act1Landscape from './acts/Act1Landscape';
import Act2OltpOlap from './acts/Act2OltpOlap';
import Act3Cube from './acts/Act3Cube';
import Act4Schemas from './acts/Act4Schemas';
import Act5Medallion from './acts/Act5Medallion';
import Act6Mining from './acts/Act6Mining';
import Act7Sql from './acts/Act7Sql';
import Act8Takehome from './acts/Act8Takehome';
import Act9Finance from './acts/Act9Finance';

export default function App() {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen">
        <NavRail />
        <main className="flex-1 min-w-0">
          <TopNav />
          <div className="px-4 sm:px-8 lg:px-12 py-8 lg:py-12 max-w-6xl">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/act/1" element={<Act1Landscape />} />
              <Route path="/act/2" element={<Act2OltpOlap />} />
              <Route path="/act/3" element={<Act3Cube />} />
              <Route path="/act/4" element={<Act4Schemas />} />
              <Route path="/act/5" element={<Act5Medallion />} />
              <Route path="/act/6" element={<Act6Mining />} />
              <Route path="/act/7" element={<Act7Sql />} />
              <Route path="/act/8" element={<Act8Takehome />} />
              <Route path="/act/9" element={<Act9Finance />} />
            </Routes>
          </div>
        </main>
        <FloatingChat />
        <ShortcutsModal />
      </div>
    </ThemeProvider>
  );
}
