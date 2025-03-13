export interface ReownConfig {
    apiKey: string;
    organizationId?: string;
    environment?: 'production' | 'sandbox';
    baseUrl?: string;
}

export interface ReownUser {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    metadata?: Record<string, any>;
}

export interface ReownSession {
    id: string;
    userId: string;
    expiresAt: Date;
    metadata?: Record<string, any>;
}

export interface ReownToken {
    token: string;
    expiresAt: Date;
}