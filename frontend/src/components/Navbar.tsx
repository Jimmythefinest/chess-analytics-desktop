import { NavLink } from 'react-router-dom';
import './Navbar.css';

export function Navbar() {
    return (
        <nav className="navbar">
            <div className="container navbar-container">
                <NavLink to="/" className="navbar-brand">
                    <span className="brand-icon">♟</span>
                    <span className="brand-text">Chess Analytics</span>
                </NavLink>

                <div className="navbar-links">
                    <NavLink
                        to="/"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        end
                    >
                        Dashboard
                    </NavLink>
                    <NavLink
                        to="/games"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        Games
                    </NavLink>
                    <NavLink
                        to="/openings"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        Openings
                    </NavLink>
                    <NavLink
                        to="/import"
                        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    >
                        Import
                    </NavLink>
                </div>
            </div>
        </nav>
    );
}
