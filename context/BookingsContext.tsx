import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BookingStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

export type Player = {
  id: string;
  name: string;
  paid: boolean;
};

export type Booking = {
  id: string;
  venueId: string;
  venueName: string;
  fieldSize: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: BookingStatus;
  players: Player[];
  createdAt: string;
};

export type Venue = {
  id: string;
  name: string;
  location: string;
  district: string;
  rating: number;
  reviewCount: number;
  pricePerHour: number;
  fieldSizes: string[];
  amenities: string[];
  imageColor: string;
  isOpen: boolean;
  openHours: string;
  lat: number;
  lon: number;
};

interface BookingsContextValue {
  bookings: Booking[];
  addBooking: (booking: Booking) => void;
  updateBooking: (id: string, updates: Partial<Booking>) => void;
  cancelBooking: (id: string) => void;
  rebookLast: () => Booking | null;
  activeCount: number;
  isLoading: boolean;
}

const BookingsContext = createContext<BookingsContextValue | null>(null);

const STORAGE_KEY = 'shootha_bookings';

export const MOCK_VENUES: Venue[] = [
  {
    id: '1',
    name: 'ملعب النجوم',
    location: 'حي النور، الموصل',
    district: 'حي النور',
    rating: 4.8,
    reviewCount: 124,
    pricePerHour: 25000,
    fieldSizes: ['5 ضد 5', '7 ضد 7'],
    amenities: ['إضاءة', 'مياه', 'غرف تبديل', 'موقف سيارات'],
    imageColor: '#1A2F1A',
    isOpen: true,
    openHours: '8:00 - 24:00',
    lat: 36.335,
    lon: 43.119,
  },
  {
    id: '2',
    name: 'ملعب الأبطال',
    location: 'حي الجامعة، الموصل',
    district: 'حي الجامعة',
    rating: 4.6,
    reviewCount: 89,
    pricePerHour: 30000,
    fieldSizes: ['7 ضد 7', '11 ضد 11'],
    amenities: ['إضاءة', 'مياه', 'كافيتيريا'],
    imageColor: '#1A1A2F',
    isOpen: true,
    openHours: '9:00 - 23:00',
    lat: 36.340,
    lon: 43.130,
  },
  {
    id: '3',
    name: 'ستاد الفردوس',
    location: 'حي الزهور، الموصل',
    district: 'حي الزهور',
    rating: 4.5,
    reviewCount: 67,
    pricePerHour: 20000,
    fieldSizes: ['5 ضد 5'],
    amenities: ['إضاءة', 'مياه'],
    imageColor: '#2F1A1A',
    isOpen: false,
    openHours: '14:00 - 22:00',
    lat: 36.325,
    lon: 43.110,
  },
  {
    id: '4',
    name: 'ملعب الشباب',
    location: 'حي المثنى، الموصل',
    district: 'حي المثنى',
    rating: 4.3,
    reviewCount: 42,
    pricePerHour: 22000,
    fieldSizes: ['5 ضد 5', '7 ضد 7'],
    amenities: ['إضاءة', 'موقف سيارات'],
    imageColor: '#2F2A1A',
    isOpen: true,
    openHours: '10:00 - 24:00',
    lat: 36.350,
    lon: 43.125,
  },
  {
    id: '5',
    name: 'ملعب الرياضيين',
    location: 'حي التحرير، الموصل',
    district: 'حي التحرير',
    rating: 4.7,
    reviewCount: 156,
    pricePerHour: 35000,
    fieldSizes: ['7 ضد 7', '11 ضد 11'],
    amenities: ['إضاءة', 'مياه', 'غرف تبديل', 'كافيتيريا', 'موقف سيارات'],
    imageColor: '#1A2A2F',
    isOpen: true,
    openHours: '7:00 - 24:00',
    lat: 36.355,
    lon: 43.105,
  },
];

export const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00',
  '16:00', '17:00', '18:00', '19:00',
  '20:00', '21:00', '22:00', '23:00',
];

export function BookingsProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setBookings(JSON.parse(stored));
      } else {
        const sample: Booking[] = [
          {
            id: 'b1',
            venueId: '1',
            venueName: 'ملعب النجوم',
            fieldSize: '7 ضد 7',
            date: getDateString(1),
            time: '19:00',
            duration: 1,
            price: 25000,
            status: 'upcoming',
            players: [
              { id: 'p1', name: 'أحمد', paid: true },
              { id: 'p2', name: 'محمد', paid: false },
              { id: 'p3', name: 'علي', paid: true },
            ],
            createdAt: new Date().toISOString(),
          },
          {
            id: 'b2',
            venueId: '2',
            venueName: 'ملعب الأبطال',
            fieldSize: '5 ضد 5',
            date: getDateString(-3),
            time: '20:00',
            duration: 1,
            price: 30000,
            status: 'completed',
            players: [
              { id: 'p1', name: 'أحمد', paid: true },
              { id: 'p4', name: 'حسن', paid: true },
            ],
            createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
          },
        ];
        setBookings(sample);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
      }
    } catch (e) {
      console.error('Failed to load bookings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const saveBookings = async (newBookings: Booking[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newBookings));
    } catch (e) {
      console.error('Failed to save bookings:', e);
    }
  };

  const addBooking = (booking: Booking) => {
    const updated = [booking, ...bookings];
    setBookings(updated);
    saveBookings(updated);
  };

  const updateBooking = (id: string, updates: Partial<Booking>) => {
    const updated = bookings.map(b => b.id === id ? { ...b, ...updates } : b);
    setBookings(updated);
    saveBookings(updated);
  };

  const cancelBooking = (id: string) => {
    updateBooking(id, { status: 'cancelled' });
  };

  const rebookLast = (): Booking | null => {
    const completed = bookings.filter(b => b.status === 'completed');
    if (completed.length === 0) return null;
    const last = completed[0];
    const newDate = getDateString(7, last.date);
    const newBooking: Booking = {
      ...last,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: newDate,
      status: 'upcoming',
      players: [{ id: 'p_me', name: 'أنا', paid: true }],
      createdAt: new Date().toISOString(),
    };
    addBooking(newBooking);
    return newBooking;
  };

  const activeCount = useMemo(
    () => bookings.filter(b => b.status === 'active' || b.status === 'upcoming').length,
    [bookings]
  );

  const value = useMemo(() => ({
    bookings,
    addBooking,
    updateBooking,
    cancelBooking,
    rebookLast,
    activeCount,
    isLoading,
  }), [bookings, isLoading, activeCount]);

  return (
    <BookingsContext.Provider value={value}>
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookings() {
  const ctx = useContext(BookingsContext);
  if (!ctx) throw new Error('useBookings must be used within BookingsProvider');
  return ctx;
}

function getDateString(daysOffset: number, fromDate?: string): string {
  const base = fromDate ? new Date(fromDate) : new Date();
  base.setDate(base.getDate() + daysOffset);
  return base.toISOString().split('T')[0];
}

export function formatDate(dateStr: string): string {
  const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const d = new Date(dateStr);
  return `${days[d.getDay()]}، ${d.getDate()} ${months[d.getMonth()]}`;
}

export function formatPrice(price: number): string {
  return price.toLocaleString('ar-IQ') + ' د.ع';
}
