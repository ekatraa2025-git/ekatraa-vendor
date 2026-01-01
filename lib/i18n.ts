import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
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
            // Add more translations as needed
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
        }
    }
};

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: 'en', // default language
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;
