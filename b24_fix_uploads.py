#!/usr/bin/env python3
import os, sys

root = os.getcwd()
check = os.path.join(root, "src", "context", "AuthContext.js")
if not os.path.isfile(check):
    print(f"[!] Could not find {check}")
    print("    cd into your project root (the folder with src/ and App.js) and run again.")
    sys.exit(1)

FILES = {
    "src/context/AuthContext.js": [],
    "src/screens/SettingsScreen.js": [],
    "src/screens/ChatDetailScreen.js": [],
    "src/screens/GroupChatDetailScreen.js": [],
}

FILES["src/context/AuthContext.js"] = [
    (
"""import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';""",
"""import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';"""
    ),
    (
"""  async function apiUpload(path, formData) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Upload failed');
    }
    return data;
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLocked, loading, login, logout, unlock, lockNow, apiRequest, apiUpload, updateUserPoints, updateUserAvatar }}
    >""",
"""  async function apiUpload(path, formData) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || data?.message || 'Upload failed');
    }
    return data;
  }

  async function apiUploadFile(path, uri, options = {}) {
    const { fieldName = 'file', filename, mimeType, fields = {} } = options;
    const result = await FileSystem.uploadAsync(`${API_BASE}${path}`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName,
      mimeType: mimeType || 'application/octet-stream',
      parameters: fields,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    let data = {};
    try {
      data = JSON.parse(result.body);
    } catch (e) {}
    if (result.status < 200 || result.status >= 300) {
      throw new Error(data?.error || data?.message || 'Upload failed');
    }
    return data;
  }

  return (
    <AuthContext.Provider
      value={{ user, token, isLocked, loading, login, logout, unlock, lockNow, apiRequest, apiUpload, apiUploadFile, updateUserPoints, updateUserAvatar }}
    >"""
    ),
]

FILES["src/screens/SettingsScreen.js"] = [
    (
"""  const { user, logout, apiRequest, apiUpload, updateUserAvatar } = useAuth();""",
"""  const { user, logout, apiRequest, apiUpload, apiUploadFile, updateUserAvatar } = useAuth();"""
    ),
    (
"""    try {
      const formData = new FormData();
      formData.append('file', { uri, name: 'avatar.jpg', type: 'image/jpeg' });
      formData.append('type', 'avatar');
      const res = await apiUpload('/media/upload', formData);
      await updateUserAvatar(res.url);""",
"""    try {
      const res = await apiUploadFile('/media/upload', uri, {
        filename: 'avatar.jpg',
        mimeType: 'image/jpeg',
        fields: { type: 'avatar' },
      });
      await updateUserAvatar(res.url);"""
    ),
]

FILES["src/screens/ChatDetailScreen.js"] = [
    (
"""  const { apiRequest, apiUpload, user, token } = useAuth();""",
"""  const { apiRequest, apiUpload, apiUploadFile, user, token } = useAuth();"""
    ),
    (
"""  async function uploadAndSendAttachment(uri, filename, mimeType, mediaType) {
    if (!socketRef.current) return;
    try {
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mimeType || 'application/octet-stream' });
      formData.append('type', mediaType);
      const result = await apiUpload('/media/upload', formData);""",
"""  async function uploadAndSendAttachment(uri, filename, mimeType, mediaType) {
    if (!socketRef.current) return;
    try {
      const result = await apiUploadFile('/media/upload', uri, {
        filename,
        mimeType: mimeType || 'application/octet-stream',
        fields: { type: mediaType },
      });"""
    ),
    (
"""  async function uploadAndSendLazyVideo(uri, filename, mimeType) {
    if (!socketRef.current) return;
    try {
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mimeType || 'video/mp4' });
      const result = await apiUpload('/files/upload', formData);""",
"""  async function uploadAndSendLazyVideo(uri, filename, mimeType) {
    if (!socketRef.current) return;
    try {
      const result = await apiUploadFile('/files/upload', uri, {
        filename,
        mimeType: mimeType || 'video/mp4',
      });"""
    ),
    (
"""      const formData = new FormData();
      formData.append('file', { uri, name: 'voice.m4a', type: 'audio/m4a' });
      formData.append('type', 'voice');

      const res = await apiUpload('/media/upload', formData);""",
"""      const res = await apiUploadFile('/media/upload', uri, {
        filename: 'voice.m4a',
        mimeType: 'audio/m4a',
        fields: { type: 'voice' },
      });"""
    ),
]

FILES["src/screens/GroupChatDetailScreen.js"] = [
    (
"""  const { apiRequest, apiUpload, user, token } = useAuth();""",
"""  const { apiRequest, apiUpload, apiUploadFile, user, token } = useAuth();"""
    ),
    (
"""  async function uploadAndSendGroupAttachment(uri, filename, mimeType, mediaType) {
    if (!socketRef.current) return;
    try {
      const formData = new FormData();
      formData.append('file', { uri, name: filename, type: mimeType || 'application/octet-stream' });
      formData.append('type', mediaType);
      const result = await apiUpload('/media/upload', formData);""",
"""  async function uploadAndSendGroupAttachment(uri, filename, mimeType, mediaType) {
    if (!socketRef.current) return;
    try {
      const result = await apiUploadFile('/media/upload', uri, {
        filename,
        mimeType: mimeType || 'application/octet-stream',
        fields: { type: mediaType },
      });"""
    ),
]

ok, failed = 0, 0
for rel_path, patches in FILES.items():
    full = os.path.join(root, rel_path)
    if not os.path.isfile(full):
        print(f"[!] Missing file, skipped: {rel_path}")
        failed += 1
        continue
    with open(full, "r", encoding="utf-8") as fh:
        src = fh.read()
    original = src
    for old, new in patches:
        count = src.count(old)
        if count != 1:
            print(f"[!] {rel_path}: expected 1 match, found {count} - skipping this hunk")
            continue
        src = src.replace(old, new, 1)
    if src == original:
        print(f"[=] {rel_path}: nothing changed")
        continue
    with open(full + ".bak", "w", encoding="utf-8") as fh:
        fh.write(original)
    with open(full, "w", encoding="utf-8") as fh:
        fh.write(src)
    print(f"[+] Patched {rel_path} (backup: {rel_path}.bak)")
    ok += 1

print()
print(f"Done. {ok} file(s) patched.")
if failed:
    print(f"{failed} file(s) missing - check your folder structure.")
