import {Route, BrowserRouter as Router, Routes} from "react-router-dom";
import './App.css';
import QrFixAr from "./projects/zboom/QrFixAr";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<div>index</div>}/>
                <Route path="/stage" element={<QrFixAr/>}/>
            </Routes>
        </Router>
    );
}

export default App;
