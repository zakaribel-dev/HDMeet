import React, { Component } from 'react'
import Main from './components/Main.jsx'
import Home from './components/Home.jsx'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

class App extends Component {
	render() {
		return (
            <div>
                <Router>
                    <Routes>
                        <Route path="/" exact element={<Home />} />
                        <Route path="/:url" element={<Main />} />
                    </Routes>
                </Router>
            </div>
        )
	}
}

export default App;