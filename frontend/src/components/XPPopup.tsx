import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

interface XPPopupProps {
  xpEarned: number;
  levelUp?: boolean;
  newLevel?: number;
}

export default function XPPopup({ xpEarned, levelUp, newLevel }: XPPopupProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (xpEarned <= 0) return;
    const timer = setTimeout(() => setVisible(false), 2000);
    return () => clearTimeout(timer);
  }, [xpEarned]);

  if (xpEarned <= 0) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.8 }}
          transition={{ type: 'spring', damping: 12, stiffness: 200 }}
          className="fixed bottom-24 right-6 z-50 flex flex-col items-end gap-1"
        >
          <motion.div
            className="px-4 py-2 rounded-xl"
            style={{
              background: 'rgba(196,149,106,0.9)',
              backdropFilter: 'blur(10px)',
              color: '#1a1714',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}
          >
            +{xpEarned} XP
          </motion.div>
          {levelUp && newLevel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="px-4 py-2 rounded-xl"
              style={{
                background: 'rgba(120,180,120,0.9)',
                backdropFilter: 'blur(10px)',
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              🎉 Level Up! → Lv.{newLevel}
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
