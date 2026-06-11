/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((toast) => {
          let styleClass = 'border-primary-container-variant bg-white';
          let textIconColor = 'text-primary';
          let icon = <Info className="h-5 w-5" />;

          if (toast.type === 'success') {
            styleClass = 'border-secondary bg-white';
            textIconColor = 'text-secondary';
            icon = <CheckCircle2 className="h-5 w-5" />;
          } else if (toast.type === 'error') {
            styleClass = 'border-error bg-white';
            textIconColor = 'text-error';
            icon = <AlertCircle className="h-5 w-5" />;
          } else if (toast.type === 'warning') {
            styleClass = 'border-yellow-500 bg-white';
            textIconColor = 'text-yellow-600';
            icon = <AlertTriangle className="h-5 w-5" />;
          }

          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -15, scale: 0.9 }}
              className={`flex items-start gap-3 px-4 py-3.5 border-l-4 shadow-xl text-xs font-bold uppercase tracking-wider rounded pointer-events-auto ${styleClass}`}
            >
              <div className={`${textIconColor} shrink-0 mt-0.5`}>
                {icon}
              </div>
              <div className="flex-grow text-[11px] text-on-surface font-body leading-relaxed pr-2">
                {toast.message}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-outline hover:text-on-surface transition-colors cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
