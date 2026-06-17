import { useEffect } from "react";
import { useAuth } from "./store/authStore";
import { useGame } from "./store/gameStore";
import { useUI } from "./store/uiStore";
import { Background, Logo } from "./ui/components/Layout";
import Toast from "./ui/components/Toast";
import AuthScreen from "./ui/AuthScreen";
import MainMenu from "./ui/MainMenu";
import LobbyBrowser from "./ui/LobbyBrowser";
import CreateRoom from "./ui/CreateRoom";
import Profile from "./ui/Profile";
import Leaderboard from "./ui/Leaderboard";
import RoomView from "./ui/RoomView";

function Splash() {
  return (
    <Background>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <Logo />
        <div className="animate-pulse text-white/60">lädt…</div>
      </div>
    </Background>
  );
}

export default function App() {
  const ready = useAuth((s) => s.ready);
  const user = useAuth((s) => s.user);
  const init = useAuth((s) => s.init);
  const connected = useGame((s) => s.connected);
  const screen = useUI((s) => s.screen);

  useEffect(() => {
    init();
  }, [init]);

  if (!ready) return <Splash />;
  if (!user) {
    return (
      <>
        <AuthScreen />
        <Toast />
      </>
    );
  }
  if (connected) {
    return (
      <>
        <RoomView />
        <Toast />
      </>
    );
  }

  return (
    <>
      {screen === "menu" && <MainMenu />}
      {screen === "browser" && <LobbyBrowser />}
      {screen === "create" && <CreateRoom />}
      {screen === "profile" && <Profile />}
      {screen === "leaderboard" && <Leaderboard />}
      <Toast />
    </>
  );
}
