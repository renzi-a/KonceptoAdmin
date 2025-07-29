// KonceptoAdmin/echo.js (or wherever you set up Echo)
import Echo from 'laravel-echo';
import Pusher from 'pusher-js/react-native'; 

import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios'; // Assuming you use Axios for API calls

// --- Your Laravel API and Reverb Configuration ---
// These should match your Laravel .env and network setup
const LARAVEL_API_BASE_URL = 'http://192.168.1.12/KonceptoAdmin/api'; 
const REVERB_APP_ID = '180503';
const REVERB_APP_KEY = 'd8wnxzxhorbb9rk86wjb';
const REVERB_HOST = '192.168.1.12'; // Your computer's local IP address
const REVERB_PORT = 8080; // Default Reverb port, verify in config/reverb.php
const REVERB_SCHEME = 'http'; // Use 'https' if you have SSL set up for Reverb (production)


window.Pusher = Pusher;

const EchoClient = new Echo({
    broadcaster: 'reverb',
    key: REVERB_APP_KEY,
    wsHost: REVERB_HOST,
    wsPort: REVERB_PORT,
    wssPort: REVERB_PORT, // Often same as wsPort if no dedicated wss setup
    forceTLS: REVERB_SCHEME === 'https',
    disableStats: true,

    authorizer: (channel, options) => {
        return {
            authorize: async (socketId, callback) => {
                try {
                    const authToken = await AsyncStorage.getItem('token'); // Fetch your stored API token
                    if (!authToken) {
                        console.error('No authentication token found for Echo authorization.');
                        callback(true, 'Authentication token missing.');
                        return;
                    }

                    // Make an HTTP POST request to your Laravel backend's broadcasting authentication endpoint
                    const response = await axios.post(`${LARAVEL_API_BASE_URL}/broadcasting/auth`, {
                        socket_id: socketId,
                        channel_name: channel.name,
                    }, {
                        headers: {
                            Authorization: `Bearer ${authToken}`,
                            'X-Requested-With': 'XMLHttpRequest', // Important for Laravel's Auth guard
                        },
                    });

                    callback(false, response.data); // Success
                } catch (error) {
                    console.error('Echo authorization error:', error.response?.data || error.message || error);
                    callback(true, error); // Failure
                }
            }
        };
    }
});

export default EchoClient;
