/**
 * Image Upload Service
 * Handles uploading images to Supabase Storage
 */

import * as ImagePicker from "expo-image-picker";
import { supabase } from "@smileguard/supabase-client";

export interface ImagePickerResult {
  uri: string;
  name: string;
  type: string;
}

/**
 * Request permission to access device media library
 */
export const requestMediaPermission = async (): Promise<boolean> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  } catch (error) {
    console.error("❌ Permission request failed:", error);
    return false;
  }
};

/**
 * Pick an image from device and return file info
 */
export const pickImage = async (): Promise<ImagePickerResult | null> => {
  try {
    const hasPermission = await requestMediaPermission();
    if (!hasPermission) {
      throw new Error("Media library permission denied");
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square for profile pictures
      quality: 0.7,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];
    const fileUri = asset.uri;

    // Extract filename from URI or create one
    let filename = "profile_picture";
    if (fileUri.includes("/")) {
      const parts = fileUri.split("/");
      filename = parts[parts.length - 1] || filename;
    }

    return {
      uri: fileUri,
      name: filename,
      type: asset.mimeType || "image/jpeg",
    };
  } catch (error) {
    console.error("❌ Image picker failed:", error);
    throw error;
  }
};

/**
 * Upload image to Supabase Storage
 * @param image Image to upload
 * @param userId User ID for organizing storage
 * @returns URL of uploaded image
 */
export const uploadProfileImage = async (
  image: ImagePickerResult,
  userId: string
): Promise<string> => {
  try {
    console.log("📤 Starting image upload...");

    // Read the image file
    const response = await fetch(image.uri);
    const blob = await response.blob();

    // Create unique filename
    const timestamp = Date.now();
    const filename = `doctor-profiles/${userId}/profile_${timestamp}`;

    console.log("📁 Uploading to path:", filename);

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("doctor-pictures")
      .upload(filename, blob, {
        cacheControl: "3600",
        upsert: true,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    console.log("✅ Upload successful:", data);

    // Get public URL
    const { data: publicUrl } = supabase.storage
      .from("doctor-pictures")
      .getPublicUrl(filename);

    if (!publicUrl?.publicUrl) {
      throw new Error("Failed to get public URL");
    }

    console.log("🔗 Public URL:", publicUrl.publicUrl);
    return publicUrl.publicUrl;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image upload failed";
    console.error("❌ Upload error:", message);
    throw error;
  }
};

/**
 * Delete image from Supabase Storage
 */
export const deleteProfileImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extract path from URL
    const urlParts = imageUrl.split("/storage/v1/object/public/doctor-pictures/");
    if (urlParts.length < 2) {
      throw new Error("Invalid image URL");
    }

    const filePath = decodeURIComponent(urlParts[1]);
    console.log("🗑️  Deleting image:", filePath);

    const { error } = await supabase.storage
      .from("doctor-pictures")
      .remove([filePath]);

    if (error) {
      throw error;
    }

    console.log("✅ Image deleted successfully");
  } catch (error) {
    console.error("❌ Delete failed:", error);
    throw error;
  }
};
