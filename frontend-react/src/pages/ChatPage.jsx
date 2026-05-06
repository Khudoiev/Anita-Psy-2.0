import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useUIStore } from '../stores/uiStore';
import { api } from '../services/api';
import Sidebar from '../components/chat/Sidebar';
import ChatArea from '../components/chat/ChatArea';
import WelcomeScreen from '../components/chat/WelcomeScreen';
import OnboardingModal from '../components/modals/OnboardingModal';
import InsightsModal from '../components/modals/InsightsModal';
import SettingsModal from '../components/modals/SettingsModal';

export default function ChatPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user, token, setAuth } = useAuthStore();
  const { currentConversationId, setConversations } = useChatStore();
  const { showOnboarding, showInsights, showSettings, openOnboarding } = useUIStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }
    init();
  }, []);

  const init = async () => {
    try {
      const conversations = await api.getConversations();
      setConversations(conversations);

      const memory = await api.getMemory();
      if (!memory.is_onboarded) {
        openOnboarding();
      }

      if (!user?.username) {
        const me = await api.getMe();
        setAuth(token, me.username);
      }
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        {currentConversationId ? <ChatArea /> : <WelcomeScreen />}
      </div>

      {showOnboarding && <OnboardingModal />}
      {showInsights && <InsightsModal />}
      {showSettings && <SettingsModal />}
    </div>
  );
}
