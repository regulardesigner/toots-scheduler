import axios from 'axios';

export function handleApiError(error: any): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || 'API request failed';
  }
  return error.message || 'An unknown error occurred';
}