import { Injectable, Optional, Inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ReownConfig, ReownUser, ReownSession, ReownToken } from '../models';

@Injectable({
    providedIn: 'root'
})
export class ReownAppKitService {
    private readonly DEFAULT_BASE_URL = 'https://api.reown.com';
    private config: ReownConfig;
    private currentUserSubject = new BehaviorSubject<ReownUser | null>(null);
    private currentSessionSubject = new BehaviorSubject<ReownSession | null>(null);
    private tokenStorageKey = 'reown_token';

    constructor(
        private http: HttpClient,
        @Optional() @Inject('REOWN_CONFIG') config?: ReownConfig
    ) {
        if (!config) {
            console.warn('ReownAppKit: No configuration provided.');
        }
        this.config = config || { apiKey: '' };
        this.config.environment = this.config.environment || 'production';
        this.config.baseUrl = this.config.baseUrl || this.DEFAULT_BASE_URL;

        // Try to restore session from localStorage
        this.restoreSession();
    }

    /**
     * Initialize the AppKit with configuration
     */
    public init(config: ReownConfig): void {
        this.config = {
            ...this.config,
            ...config
        };
    }

    /**
     * Get the current authenticated user
     */
    public get currentUser(): Observable<ReownUser | null> {
        return this.currentUserSubject.asObservable();
    }

    /**
     * Get the current session
     */
    public get currentSession(): Observable<ReownSession | null> {
        return this.currentSessionSubject.asObservable();
    }

    /**
     * Sign up a new user
     */
    public signUp(email: string, password: string, userData?: Partial<ReownUser>): Observable<ReownUser> {
        return this.http.post<{ user: ReownUser, token: ReownToken }>(
            `${this.config.baseUrl}/users`,
            { email, password, ...userData },
            { headers: this.getHeaders() }
        ).pipe(
            map(response => {
                this.setToken(response.token);
                this.currentUserSubject.next(response.user);
                return response.user;
            }),
            catchError(error => {
                console.error('ReownAppKit: Sign up failed', error);
                return throwError(() => new Error(error.message || 'Sign up failed'));
            })
        );
    }

    /**
     * Sign in an existing user
     */
    public signIn(email: string, password: string): Observable<ReownSession> {
        return this.http.post<{ user: ReownUser, session: ReownSession, token: ReownToken }>(
            `${this.config.baseUrl}/sessions`,
            { email, password },
            { headers: this.getHeaders() }
        ).pipe(
            map(response => {
                this.setToken(response.token);
                this.currentUserSubject.next(response.user);
                this.currentSessionSubject.next(response.session);
                return response.session;
            }),
            catchError(error => {
                console.error('ReownAppKit: Sign in failed', error);
                return throwError(() => new Error(error.message || 'Sign in failed'));
            })
        );
    }

    /**
     * Sign out the current user
     */
    public signOut(): Observable<void> {
        const sessionId = this.currentSessionSubject.value?.id;

        if (!sessionId) {
            this.clearSession();
            return of(undefined);
        }

        return this.http.delete<void>(
            `${this.config.baseUrl}/sessions/${sessionId}`,
            { headers: this.getHeaders() }
        ).pipe(
            tap(() => this.clearSession()),
            catchError(error => {
                console.error('ReownAppKit: Sign out failed', error);
                // Still clear the session even if the API call fails
                this.clearSession();
                return of(undefined);
            })
        );
    }

    /**
     * Get the current user's profile
     */
    public getUser(): Observable<ReownUser> {
        return this.http.get<{ user: ReownUser }>(
            `${this.config.baseUrl}/users/me`,
            { headers: this.getHeaders() }
        ).pipe(
            map(response => {
                this.currentUserSubject.next(response.user);
                return response.user;
            }),
            catchError(error => {
                console.error('ReownAppKit: Get user failed', error);
                return throwError(() => new Error(error.message || 'Get user failed'));
            })
        );
    }

    /**
     * Update the current user's profile
     */
    public updateUser(userData: Partial<ReownUser>): Observable<ReownUser> {
        return this.http.patch<{ user: ReownUser }>(
            `${this.config.baseUrl}/users/me`,
            userData,
            { headers: this.getHeaders() }
        ).pipe(
            map(response => {
                this.currentUserSubject.next(response.user);
                return response.user;
            }),
            catchError(error => {
                console.error('ReownAppKit: Update user failed', error);
                return throwError(() => new Error(error.message || 'Update user failed'));
            })
        );
    }

    /**
     * Request a password reset
     */
    public requestPasswordReset(email: string): Observable<void> {
        return this.http.post<void>(
            `${this.config.baseUrl}/password-reset`,
            { email },
            { headers: this.getHeaders() }
        ).pipe(
            catchError(error => {
                console.error('ReownAppKit: Request password reset failed', error);
                return throwError(() => new Error(error.message || 'Request password reset failed'));
            })
        );
    }

    /**
     * Reset password with token
     */
    public resetPassword(token: string, newPassword: string): Observable<void> {
        return this.http.post<void>(
            `${this.config.baseUrl}/password-reset/confirm`,
            { token, password: newPassword },
            { headers: this.getHeaders() }
        ).pipe(
            catchError(error => {
                console.error('ReownAppKit: Reset password failed', error);
                return throwError(() => new Error(error.message || 'Reset password failed'));
            })
        );
    }

    /**
     * Check if user is authenticated
     */
    public isAuthenticated(): boolean {
        return !!this.currentUserSubject.value && !!this.getStoredToken();
    }

    // Private methods
    private getHeaders() {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-API-Key': this.config.apiKey
        };

        if (this.config.organizationId) {
            headers['X-Organization-ID'] = this.config.organizationId;
        }

        const token = this.getStoredToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token.token}`;
        }

        return headers;
    }

    private setToken(token: ReownToken): void {
        localStorage.setItem(this.tokenStorageKey, JSON.stringify(token));
    }

    private getStoredToken(): ReownToken | null {
        const tokenStr = localStorage.getItem(this.tokenStorageKey);
        if (!tokenStr) return null;

        try {
            const token = JSON.parse(tokenStr) as ReownToken;

            // Check if token is expired
            if (new Date(token.expiresAt) < new Date()) {
                this.clearSession();
                return null;
            }

            return token;
        } catch (error) {
            this.clearSession();
            return null;
        }
    }

    private clearSession(): void {
        localStorage.removeItem(this.tokenStorageKey);
        this.currentUserSubject.next(null);
        this.currentSessionSubject.next(null);
    }

    private restoreSession(): void {
        const token = this.getStoredToken();
        if (token) {
            this.getUser().subscribe();
        }
    }
}