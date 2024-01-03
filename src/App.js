import React, { Component } from 'react'
import Main from './components/Main.jsx'
import Home from './components/Home.jsx'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthAdmin from './components/admin/AuthAdmin.jsx';
import AdminPanel from './components/admin/AdminPanel.jsx';

class App extends Component {
	render() {
		return (
            <div>
                <Router>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/AuthAdmin" element={<AuthAdmin />} /> 
                        <Route path="/AdminPanel" element={<AdminPanel />} /> 
                        <Route path="/:url" element={<Main />} />
                    </Routes>
                </Router>
            </div>
        )
	}
}

export default App;
