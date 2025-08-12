import {Route, BrowserRouter as Router, Routes} from "react-router-dom";
import './App.css';
import QrFixAr from "./projects/zboom/QrFixAr";
import QrFixArStageOneDevelop from "./projects/zboom/QrFixArStageOneDevelop";

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<div>index</div>}/>
                <Route path="/stage" element={<QrFixAr/>}/>
                <Route path="/stage1" element={<QrFixArStageOneDevelop/>}/>
            </Routes>
        </Router>
    );
}

export default App;
