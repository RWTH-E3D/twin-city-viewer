import { defineStore } from 'pinia';

export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationState {
  message: string;
  type: NotificationType | '';
  isVisible: boolean;
}

export const useNotificationStore = defineStore('notification', {
  state: (): NotificationState => ({
    message: '',
    type: '',
    isVisible: false
  }),

  actions: {
    show(message: string, type: NotificationType = 'info'): void {
      this.message = message;
      this.type = type;
      this.isVisible = true;
      
      setTimeout(() => {
        this.hide();
      }, 5000);
    },

    hide(): void {
      this.isVisible = false;
      this.message = '';
      this.type = '';
    }
  }
});