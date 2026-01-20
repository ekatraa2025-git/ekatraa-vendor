import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Default fallback translations (used until backend loads)
const defaultResources = {
    en: {
        translation: {
            splash_tagline: "Celebrating Togetherness with Trust and Care",
            vendor_app: "Vendor App",
            coming_together: "Coming Together",
            login: "Login",
            verify: "Verify",
            dashboard: "Dashboard",
            services: "Services",
            calendar: "Calendar",
            bookings: "Bookings",
            profile: "Profile",
            select_language: "Select Language",
            total_revenue: "Total Revenue",
            active_bookings: "Active Bookings",
            upcoming_bookings: "Upcoming Bookings",
            quick_actions: "Quick Actions",
            quotations: "Quotations",
            manage: "Manage",
            select_service: "Select Service",
            amount: "Amount",
            valid_until: "Valid Until",
            terms: "Terms & Conditions",
            save: "Save",
            create_quotation: "Create Quotation",
            generate_receipt: "Generate Receipt",
            thank_you: "Thank You",
            settings: "Settings",
            contact_support: "Contact Support",
            phone_support: "Phone Support",
            email_support: "Email Support",
            support_hours: "Support Hours",
        }
    },
    hi: {
        translation: {
            splash_tagline: "विश्वास और देखभाल के साथ एकजुटता का जश्न मनाना",
            vendor_app: "वेंडर ऐप",
            coming_together: "एक साथ आना",
            login: "लॉगिन",
            verify: "सत्यापित करें",
            dashboard: "डैशबोर्ड",
            services: "सेवाएं",
            calendar: "कैलेंडर",
            bookings: "बुकिंग",
            profile: "प्रोफ़ाइल",
            select_language: "भाषा चुनें",
            total_revenue: "कुल आय",
            active_bookings: "सक्रिय बुकिंग",
            upcoming_bookings: "आगामी बुकिंग",
            quick_actions: "त्वरित कार्रवाई",
            quotations: "कोटेशन",
            manage: "प्रबंधित करें",
            select_service: "सेवा चुनें",
            amount: "राशि",
            valid_until: "तक मान्य",
            terms: "नियम और शर्तें",
            save: "सहेजें",
            create_quotation: "कोटेशन बनाएं",
            generate_receipt: "रसीद जनरेट करें",
            thank_you: "धन्यवाद",
            settings: "सेटिंग्स",
            contact_support: "सहायता से संपर्क करें",
            phone_support: "फोन सहायता",
            email_support: "ईमेल सहायता",
            support_hours: "सहायता समय",
        }
    },
    or: {
        translation: {
            splash_tagline: "ଏକତ୍ରୀତ ହବା ପାଇଁ ଏକତ୍ର ହିଁ ଏକମାତ୍ର ଭରୋସା ଓ ସାହାରା",
            vendor_app: "ଭେଣ୍ଡର ଆପ୍",
            coming_together: "ଏକାଠି ହେବା",
            login: "ଲଗଇନ୍",
            verify: "ଯାଞ୍ଚ କରନ୍ତୁ",
            dashboard: "ଡ୍ୟାସବୋର୍ଡ",
            services: "ସେବାଗୁଡିକ",
            calendar: "କ୍ୟାଲେଣ୍ଡର",
            bookings: "ବୁକିଂ",
            profile: "ପ୍ରୋଫାଇଲ୍",
            select_language: "ଭାଷା ବାଛନ୍ତୁ",
            total_revenue: "ସମୁଦାୟ ରାଜସ୍ୱ",
            active_bookings: "ସକ୍ରିୟ ବୁକିଂ",
            upcoming_bookings: "ଆଗାମୀ ବୁକିଂ",
            quick_actions: "କ୍ଷୀପ୍ର କାର୍ଯ୍ୟାନୁଷ୍ଠାନ",
            quotations: "କ୍ଵୋଟେସନ୍",
            manage: "ପରିଚାଳନା କରନ୍ତୁ",
            select_service: "ସେବା ବାଛନ୍ତୁ",
            amount: "ପରିମାଣ",
            valid_until: "ପର୍ଯ୍ୟନ୍ତ ବୈଧ",
            terms: "ନିୟମ ଏବଂ ସର୍ତ୍ତ",
            save: "ସଂରକ୍ଷଣ କରନ୍ତୁ",
            create_quotation: "କ୍ଵୋଟେସନ୍ ପ୍ରସ୍ତୁତ କରନ୍ତୁ",
            generate_receipt: "ରସିଦ ପ୍ରସ୍ତୁତ କରନ୍ତୁ",
            thank_you: "ଧନ୍ୟବାଦ",
            settings: "ସେଟିଂସଙ୍ଗ",
            contact_support: "ସମର୍ଥନ ଯୋଗାଯୋଗ କରନ୍ତୁ",
            phone_support: "ଫୋନ୍ ସମର୍ଥନ",
            email_support: "ଇମେଲ୍ ସମର୍ଥନ",
            support_hours: "ସମର୍ଥନ ସମୟ",
        }
    }
};

// Backend API URL for translations
import Constants from 'expo-constants';
import { supabase } from './supabase';

const getApiUrl = (): string | null => {
    // Try process.env first
    const processEnv = process.env.EXPO_PUBLIC_API_URL;
    if (processEnv) return `${processEnv}/api/translations`;
    
    // Try Constants.expoConfig.extra
    const extraConfig = Constants.expoConfig?.extra;
    if (extraConfig?.EXPO_PUBLIC_API_URL) {
        return `${extraConfig.EXPO_PUBLIC_API_URL}/api/translations`;
    }
    
    // Try app.json extra without EXPO_PUBLIC_ prefix
    if (extraConfig?.API_URL) {
        return `${extraConfig.API_URL}/api/translations`;
    }
    
    return null;
};

const TRANSLATIONS_API_URL = getApiUrl();

// Function to load translations from backend (via API or Supabase)
export const loadTranslationsFromBackend = async () => {
    // Try API first if configured
    if (TRANSLATIONS_API_URL) {
        try {
            const response = await fetch(TRANSLATIONS_API_URL);
            if (response.ok) {
                const data = await response.json();
                
                // Update i18n resources with backend data
                if (data.en) {
                    i18n.addResourceBundle('en', 'translation', data.en, true, true);
                }
                if (data.hi) {
                    i18n.addResourceBundle('hi', 'translation', data.hi, true, true);
                }
                if (data.or) {
                    i18n.addResourceBundle('or', 'translation', data.or, true, true);
                }
                
                console.log('Translations loaded from backend API');
                return;
            }
        } catch (error) {
            console.warn('Failed to load translations from API, trying Supabase:', error);
        }
    }

    // Fallback to Supabase direct query
    try {
        const { data: translations, error } = await supabase
            .from('translations')
            .select('key, en, hi, "or"')
            .order('key', { ascending: true });

        if (error) {
            throw error;
        }

        if (translations && translations.length > 0) {
            // Convert to format expected by i18next
            const result = {
                en: {} as Record<string, string>,
                hi: {} as Record<string, string>,
                or: {} as Record<string, string>,
            };

            translations.forEach((t: any) => {
                if (t.key) {
                    result.en[t.key] = t.en || '';
                    result.hi[t.key] = t.hi || '';
                    result.or[t.key] = t['or'] || t.or || '';
                }
            });

            // Update i18n resources with backend data
            if (result.en && Object.keys(result.en).length > 0) {
                i18n.addResourceBundle('en', 'translation', result.en, true, true);
            }
            if (result.hi && Object.keys(result.hi).length > 0) {
                i18n.addResourceBundle('hi', 'translation', result.hi, true, true);
            }
            if (result.or && Object.keys(result.or).length > 0) {
                i18n.addResourceBundle('or', 'translation', result.or, true, true);
            }

            console.log('Translations loaded from Supabase');
        }
    } catch (error) {
        console.warn('Failed to load translations from Supabase, using defaults:', error);
    }
};

// Function to reload translations (useful when translations are updated in backend)
export const reloadTranslations = async () => {
    await loadTranslationsFromBackend();
    // Force i18n to reload current language
    const currentLang = i18n.language || 'en';
    i18n.changeLanguage(currentLang);
};

// Function to refresh translations and update UI
export const refreshTranslations = async () => {
    try {
        await loadTranslationsFromBackend();
        // Trigger a language change to refresh all components using translations
        const currentLang = i18n.language || 'en';
        // Force reload by changing to a different language then back
        await i18n.changeLanguage('en');
        await new Promise(resolve => setTimeout(resolve, 50));
        await i18n.changeLanguage(currentLang);
        // Emit event to notify all components
        i18n.emit('languageChanged', currentLang);
        return true;
    } catch (error) {
        console.warn('Failed to refresh translations:', error);
        return false;
    }
};

try {
    if (!i18n.isInitialized) {
        i18n
            .use(initReactI18next)
            .init({
                resources: defaultResources,
                lng: 'en', // default language
                fallbackLng: 'en',
                interpolation: {
                    escapeValue: false
                },
                react: {
                    useSuspense: false
                }
            });
        
        // Load translations from backend after a short delay to ensure i18n is ready
        setTimeout(() => {
            loadTranslationsFromBackend().then(() => {
                // After loading, trigger a language change to ensure all components update
                const currentLang = i18n.language || 'en';
                i18n.changeLanguage(currentLang).catch(console.error);
            }).catch(console.error);
        }, 100);
    } else {
        // If already initialized, just load translations
        loadTranslationsFromBackend().catch(console.error);
    }
} catch (error) {
    console.warn('i18n initialization failed:', error);
    // Ensure i18n has basic structure even if init fails
    if (!i18n.isInitialized) {
        try {
            i18n.init({
                resources: defaultResources,
                lng: 'en',
                fallbackLng: 'en',
                interpolation: { escapeValue: false },
                react: {
                    useSuspense: false
                }
            });
        } catch (e) {
            console.warn('i18n fallback init also failed:', e);
        }
    }
}

export default i18n;
