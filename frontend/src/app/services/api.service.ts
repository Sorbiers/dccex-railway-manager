import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Device, WeeklySchedule, Settings, ApiResponse, ConnectionStatus, DccCommand } from '../models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:3000/api';

  // Devices
  getDevices(): Observable<Device[]> {
    return this.http.get<ApiResponse<Device[]>>(`${this.baseUrl}/devices`)
      .pipe(map(res => res.data || []));
  }

  getDevice(id: string): Observable<Device | null> {
    return this.http.get<ApiResponse<Device>>(`${this.baseUrl}/devices/${id}`)
      .pipe(map(res => res.data || null));
  }

  createDevice(device: Partial<Device>): Observable<Device | null> {
    return this.http.post<ApiResponse<Device>>(`${this.baseUrl}/devices`, device)
      .pipe(map(res => res.data || null));
  }

  updateDevice(id: string, updates: Partial<Device>): Observable<Device | null> {
    return this.http.put<ApiResponse<Device>>(`${this.baseUrl}/devices/${id}`, updates)
      .pipe(map(res => res.data || null));
  }

  deleteDevice(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/devices/${id}`)
      .pipe(map(res => res.success));
  }

  // Schedules
  getSchedules(): Observable<WeeklySchedule[]> {
    return this.http.get<ApiResponse<WeeklySchedule[]>>(`${this.baseUrl}/schedules`)
      .pipe(map(res => res.data || []));
  }

  getSchedule(id: string): Observable<WeeklySchedule | null> {
    return this.http.get<ApiResponse<WeeklySchedule>>(`${this.baseUrl}/schedules/${id}`)
      .pipe(map(res => res.data || null));
  }

  createSchedule(schedule: Partial<WeeklySchedule>): Observable<WeeklySchedule | null> {
    return this.http.post<ApiResponse<WeeklySchedule>>(`${this.baseUrl}/schedules`, schedule)
      .pipe(map(res => res.data || null));
  }

  updateSchedule(id: string, updates: Partial<WeeklySchedule>): Observable<WeeklySchedule | null> {
    return this.http.put<ApiResponse<WeeklySchedule>>(`${this.baseUrl}/schedules/${id}`, updates)
      .pipe(map(res => res.data || null));
  }

  deleteSchedule(id: string): Observable<boolean> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/schedules/${id}`)
      .pipe(map(res => res.success));
  }

  // Settings
  getSettings(): Observable<Settings | null> {
    return this.http.get<ApiResponse<Settings>>(`${this.baseUrl}/settings`)
      .pipe(map(res => res.data || null));
  }

  updateSettings(settings: Partial<Settings>): Observable<Settings | null> {
    return this.http.put<ApiResponse<Settings>>(`${this.baseUrl}/settings`, settings)
      .pipe(map(res => res.data || null));
  }

  // Status
  getStatus(): Observable<ConnectionStatus | null> {
    return this.http.get<ApiResponse<ConnectionStatus>>(`${this.baseUrl}/status`)
      .pipe(map(res => res.data || null));
  }

  // DCC Commands
  sendCommand(command: DccCommand): Observable<boolean> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/dcc/command`, command)
      .pipe(map(res => res.success));
  }

  connectDcc(): Observable<boolean> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/dcc/connect`, {})
      .pipe(map(res => res.success));
  }

  disconnectDcc(): Observable<boolean> {
    return this.http.post<ApiResponse<void>>(`${this.baseUrl}/dcc/disconnect`, {})
      .pipe(map(res => res.success));
  }
}
