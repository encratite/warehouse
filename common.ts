export interface ErrorResponse {
    error: string;
}

export interface LoginRequest {
    username: string;
    password: string;
}

export interface LoginResponse {
    success: boolean;
}

export interface ValidateSessionResponse {
    valid: boolean;
}