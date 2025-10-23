const database = require('../config/database');

class WidgetManager {
    constructor() {
        this.collection = null;
    }

    async initialize() {
        try {
            const db = database.getDb();
            this.collection = db.collection('widget_settings');

            // Create indexes
            await this.collection.createIndex({ brokerId: 1 }, { unique: true });

            console.log('[WidgetManager] Initialized successfully');
        } catch (error) {
            console.error('[WidgetManager] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Get widget settings for a broker
     * Returns default settings if not found
     */
    async getSettings(brokerId) {
        try {
            const settings = await this.collection.findOne({ brokerId });

            if (!settings) {
                // Return default settings if not found
                return this.getDefaultSettings(brokerId);
            }

            return settings;
        } catch (error) {
            console.error(`[WidgetManager] Error getting settings for ${brokerId}:`, error);
            throw error;
        }
    }

    /**
     * Create or update widget settings
     */
    async updateSettings(brokerId, settingsData) {
        try {
            const now = new Date();

            // Remove _id from settingsData to prevent immutable field error
            const { _id, ...dataWithoutId } = settingsData;

            const settings = {
                ...dataWithoutId,
                brokerId,
                updatedAt: now
            };

            const result = await this.collection.findOneAndUpdate(
                { brokerId },
                {
                    $set: settings
                },
                {
                    upsert: true,
                    returnDocument: 'after'
                }
            );

            console.log(`[WidgetManager] Settings updated for broker ${brokerId}`);
            return result.value || result;
        } catch (error) {
            console.error(`[WidgetManager] Error updating settings for ${brokerId}:`, error);
            throw error;
        }
    }

    /**
     * Get default widget settings
     */
    getDefaultSettings(brokerId) {
        return {
            brokerId,
            enabled: false, // Disabled by default
            greetingMessage: 'Hi! How can I help you today?',
            primaryColor: '#9333ea',
            secondaryColor: '#f3f4f6',
            textColor: '#ffffff',
            position: 'bottom-right',
            widgetTitle: 'Chat Support',
            placeholderText: 'Type your message...',
            logoUrl: null,
            customCSS: '',
            settings: {
                showOnLoad: false,
                showGreeting: true,
                greetingDelay: 2000,
                allowFileUpload: false,
                showTypingIndicator: true,
                playSound: false,
                maxMessagesHistory: 50
            },
            branding: {
                showPoweredBy: true,
                customFooterText: ''
            },
            createdAt: null,
            updatedAt: null
        };
    }

    /**
     * Delete widget settings
     */
    async deleteSettings(brokerId) {
        try {
            await this.collection.deleteOne({ brokerId });
            console.log(`[WidgetManager] Settings deleted for broker ${brokerId}`);
        } catch (error) {
            console.error(`[WidgetManager] Error deleting settings for ${brokerId}:`, error);
            throw error;
        }
    }

    /**
     * Check if widget is enabled for a broker
     */
    async isWidgetEnabled(brokerId) {
        try {
            const settings = await this.collection.findOne(
                { brokerId },
                { projection: { enabled: 1 } }
            );

            return settings ? settings.enabled : false;
        } catch (error) {
            console.error(`[WidgetManager] Error checking widget status for ${brokerId}:`, error);
            return false;
        }
    }
}

// Singleton instance
const widgetManager = new WidgetManager();

module.exports = widgetManager;
