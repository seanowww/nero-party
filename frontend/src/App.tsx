import { Routes, Route, Navigate } from "react-router-dom";
import CreateParty from "./pages/CreateParty";
import JoinParty from "./pages/JoinParty";
import PartyRoom from "./pages/PartyRoom";

function App() {
  return (
    <Routes>
      <Route path="/" element={<CreateParty />} />
      <Route path="/join" element={<JoinParty />} />
      <Route path="/join/:code" element={<JoinParty />} />
      <Route path="/party/:id" element={<PartyRoom />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
