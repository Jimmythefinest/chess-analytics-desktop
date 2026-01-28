import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { GameList } from './components/GameList';
import { GameReview } from './components/GameReview';
import { Openings } from './components/Openings';
import { Import } from './components/Import';

function App() {
    return (
        <>
            <Navbar />
            <main className="page">
                <div className="container">
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/games" element={<GameList />} />
                        <Route path="/games/:id" element={<GameReview />} />
                        <Route path="/openings" element={<Openings />} />
                        <Route path="/import" element={<Import />} />
                    </Routes>
                </div>
            </main>
        </>
    );
}

export default App;
