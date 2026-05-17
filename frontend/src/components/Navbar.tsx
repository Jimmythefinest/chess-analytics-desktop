import { NavLink } from 'react-router-dom';
import './Navbar.css';

export function Navbar() {
    const windowApi = (window as any).electron?.api;

    return (
        <>
            <div className="titlebar">
                <div className="titlebar-title">Chess Analytics</div>
                {windowApi && (
                    <div className="window-controls">
                        <button
                            className="window-control"
                            type="button"
                            aria-label="Minimize"
                            onClick={() => windowApi.minimizeWindow()}
                        >
                            −
                        </button>
                        <button
                            className="window-control"
                            type="button"
                            aria-label="Maximize"
                            onClick={() => windowApi.toggleMaximizeWindow()}
                        >
                            □
                        </button>
                        <button
                            className="window-control close"
                            type="button"
                            aria-label="Close"
                            onClick={() => windowApi.closeWindow()}
                        >
                            ×
                        </button>
                    </div>
                )}
            </div>

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
                            to="/insights"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            Insights
                        </NavLink>
                        <NavLink
                            to="/explorer"
                            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                        >
                            Explorer
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
        </>
    );
}
