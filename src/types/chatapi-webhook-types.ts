/** Kommo ChatAPI v2 webhook payload — sent when agent replies in CRM */

export interface ChatApiWebhookPayload {
  account_id: string;
  time: number;
  message: {
    receiver: {
      id: string;
      name?: string;
      phone?: string;
      email?: string;
      avatar?: string;
      client_id?: string;
    };
    sender: {
      id: string;
      name?: string;
    };
    timestamp: number;
    msec_timestamp?: number;
    message: {
      id: string;
      type: string;
      text?: string;
      media?: string;
      file_name?: string;
      file_size?: number;
    };
    conversation: {
      id: string;
      client_id?: string;
    };
  };
}