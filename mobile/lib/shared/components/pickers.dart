import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

class PickedFile {
  final Uint8List bytes;
  final String name;
  PickedFile(this.bytes, this.name);
  int get size => bytes.length;
}

/// Same limits as the website and the storage buckets.
class Limits {
  static const photoBytes = 2 * 1024 * 1024; // listing photos
  static const logoBytes = 1024 * 1024; // organisation logos
  static const docBytes = 5 * 1024 * 1024; // verification documents
  static const shotBytes = 3 * 1024 * 1024; // feedback screenshots
}

/// Camera or gallery photo, resized on the device so it fits the bucket limit.
Future<PickedFile?> pickPhoto(BuildContext context, {int maxBytes = Limits.photoBytes, bool allowCamera = true}) async {
  ImageSource? src = ImageSource.gallery;
  if (allowCamera) {
    src = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (c) => SafeArea(child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Take a photo'), onTap: () => Navigator.pop(c, ImageSource.camera)),
        ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choose from gallery'), onTap: () => Navigator.pop(c, ImageSource.gallery)),
        const SizedBox(height: 8),
      ])),
    );
    if (src == null) return null;
  }
  final x = await ImagePicker().pickImage(source: src, maxWidth: 1600, maxHeight: 1600, imageQuality: 82);
  if (x == null) return null;
  final bytes = await x.readAsBytes();
  var name = x.name;
  if (!RegExp(r'\.(jpe?g|png|webp)$', caseSensitive: false).hasMatch(name)) name = '$name.jpg';
  if (bytes.length > maxBytes) throw Exception('Image must be ${maxBytes ~/ (1024 * 1024)} MB or smaller.');
  return PickedFile(bytes, name);
}

/// PDF / JPG / PNG up to 5 MB (verification documents).
Future<PickedFile?> pickDocument() async {
  final r = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: const ['pdf', 'jpg', 'jpeg', 'png']);
  if (r.isEmpty) return null;
  final f = r.first;
  final len = await f.length();
  if (len != null && len > Limits.docBytes) throw Exception('File must be 5 MB or smaller.');
  final bytes = await f.readAsBytes();
  if (bytes.length > Limits.docBytes) throw Exception('File must be 5 MB or smaller.');
  return PickedFile(bytes, f.name);
}
