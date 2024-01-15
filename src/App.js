import React, { Component } from 'react';
import Main from './components/Main.jsx';
import Home from './components/Home.jsx';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthAdmin from './components/admin/AuthAdmin.jsx';
import AdminPanel from './components/admin/AdminPanel.jsx';
import { AuthProvider } from './context/authContext.js';
import ProtectedRoute from './components/protectedRoute.jsx';

class App extends Component {

    render() {
        return (

            <AuthProvider>
                <div>
                    <Router>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/authAdmin" element={<AuthAdmin />} />
                            <Route path="/adminPanel/*" element={<ProtectedRoute component={AdminPanel} />} />
                            <Route path="/:url" element={<Main />} />
                        </Routes>
                    </Router>
                </div>
            </AuthProvider>
        );
    }
}

export default App;
