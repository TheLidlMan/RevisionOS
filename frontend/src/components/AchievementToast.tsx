import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AchievementToastProps {
  achievements: { key: string; name: string; icon: string }[];
  onDismiss?: () => void;
}

export default function AchievementToast({ achievements, onDismiss }: AchievementToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (achievements.length === 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, 4000);
    return () => clearTimeout(timer);
  }, [achievements, onDismiss]);

  if (achievements.length === 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -30, scale: 0.9 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2"
        >
          {achievements.map((ach) => (
            <motion.div
              key={ach.key}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-3 px-5 py-3 rounded-2xl"
              style={{
                background: 'rgba(196,149,106,0.95)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(196,149,106,0.3)',
                color: '#1a1714',
              }}
            >
              <span style={{ fontSize: '1.5rem' }}>{ach.icon}</span>
              <div>
                <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>Achievement Unlocked!</p>
                <p style={{ fontWeight: 400, fontSize: '0.8rem', opacity: 0.8 }}>{ach.name}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
