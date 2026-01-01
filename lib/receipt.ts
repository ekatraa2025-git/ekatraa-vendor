export interface ReceiptData {
    receiptId: string;
    bookingId: string;
    date: string;
    customerName: string;
    businessName: string;
    serviceName: string;
    amount: number;
    paymentMethod: string;
    thankYouMessage: string;
}

export const generateThankYouMessage = (customerName: string, businessName: string) => {
    return `Dear ${customerName},\n\nThank you for choosing ${businessName}! We are thrilled to be a part of your journey. Your trust in our services means everything to us.\n\nWe look forward to delivering an exceptional experience for you.\n\nWarm regards,\nTeam ${businessName}`;
};

export const formatReceiptData = (booking: any, vendor: any): ReceiptData => {
    const receiptId = `REC-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    return {
        receiptId,
        bookingId: booking.id,
        date: new Date().toLocaleDateString(),
        customerName: booking.customers?.full_name || 'Valued Customer',
        businessName: vendor.business_name || 'Ekatraa Partner',
        serviceName: booking.services?.name || 'Service',
        amount: booking.total_price || 0,
        paymentMethod: 'UPI / Online',
        thankYouMessage: generateThankYouMessage(booking.customers?.full_name || 'Valued Customer', vendor.business_name || 'Ekatraa Partner'),
    };
};
