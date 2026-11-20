// Data models mirroring the AnnSetu tables (website/sql/*.sql). Only columns that exist are mapped.
import '../constants/domain.dart';

DateTime? _dt(dynamic v) => v == null ? null : DateTime.tryParse(v.toString());
int _i(dynamic v) => v is int ? v : (v is num ? v.toInt() : int.tryParse('$v') ?? 0);
double? _d(dynamic v) => v == null ? null : (v is num ? v.toDouble() : double.tryParse('$v'));

class Profile {
  final String id;
  final Role? role;
  final String? fullName;
  Profile(this.id, this.role, this.fullName);
  factory Profile.fromJson(Map<String, dynamic> j) => Profile(j['id'], roleFrom(j['role']), j['full_name']);
}

class Organization {
  final String id, ownerId, kind, orgType, name, verification;
  final String? phone, address, about, areaServed, verificationNote, logoPath, suspendedReason;
  final double? lat, lng;
  final bool suspended;
  final DateTime? createdAt;
  final bool noCertificate;
  final String? noCertificateNote;
  final DateTime? noCertificateRequestedAt;
  String? logoUrl; // filled by the service (public bucket)
  Organization({
    required this.id, required this.ownerId, required this.kind, required this.orgType, required this.name,
    required this.verification, this.phone, this.address, this.about, this.areaServed, this.verificationNote,
    this.logoPath, this.suspendedReason, this.lat, this.lng, this.suspended = false, this.createdAt,
    this.noCertificate = false, this.noCertificateNote, this.noCertificateRequestedAt,
  });
  factory Organization.fromJson(Map<String, dynamic> j) => Organization(
        id: j['id'], ownerId: j['owner_id'] ?? '', kind: j['kind'] ?? 'donor', orgType: j['org_type'] ?? '',
        name: j['name'] ?? 'Organisation', verification: j['verification'] ?? 'pending', phone: j['phone'],
        address: j['address'], about: j['about'], areaServed: j['area_served'], verificationNote: j['verification_note'],
        logoPath: j['logo_path'], suspendedReason: j['suspended_reason'], lat: _d(j['lat']), lng: _d(j['lng']),
        suspended: j['suspended'] == true, createdAt: _dt(j['created_at']),
        noCertificate: j['no_certificate'] == true, noCertificateNote: j['no_certificate_note'],
        noCertificateRequestedAt: _dt(j['no_certificate_requested_at']),
      );
  bool get isApproved => verification == 'approved';
  bool get canAct => isApproved && !suspended;
  String get statusLabel => suspended ? 'suspended' : verification;
}

class VerificationDoc {
  final String id, orgId, path, docType, status;
  final String? reviewerNote;
  final DateTime? createdAt;
  VerificationDoc(this.id, this.orgId, this.path, this.docType, this.status, this.reviewerNote, this.createdAt);
  factory VerificationDoc.fromJson(Map<String, dynamic> j) =>
      VerificationDoc(j['id'], j['org_id'], j['path'], j['doc_type'] ?? 'other', j['status'] ?? 'pending', j['reviewer_note'], _dt(j['created_at']));
  String get label => Domain.docTypes[docType] ?? docType;
}

class Representative {
  final String id, orgId, name, phone;
  Representative(this.id, this.orgId, this.name, this.phone);
  factory Representative.fromJson(Map<String, dynamic> j) => Representative(j['id'], j['org_id'], j['name'], j['phone']);
}

class Listing {
  final String id, donorOrgId, title, category, unit, status;
  final int quantity, qtyReserved;
  final DateTime preparedAt, pickupBy;
  final DateTime? createdAt;
  final String? safetyNotes, photoPath;
  String? photoUrl, donorName, donorAddress;
  double? distanceKm;
  Listing({
    required this.id, required this.donorOrgId, required this.title, required this.category, required this.unit,
    required this.status, required this.quantity, required this.qtyReserved, required this.preparedAt,
    required this.pickupBy, this.createdAt, this.safetyNotes, this.photoPath, this.donorName, this.distanceKm,
  });
  factory Listing.fromJson(Map<String, dynamic> j) => Listing(
        id: j['id'], donorOrgId: j['donor_org_id'] ?? '', title: j['title'] ?? '', category: j['category'] ?? '',
        unit: j['unit'] ?? 'portions', status: j['status'] ?? 'active', quantity: _i(j['quantity']),
        qtyReserved: _i(j['qty_reserved']),
        preparedAt: _dt(j['prepared_at']) ?? DateTime.now(), pickupBy: _dt(j['pickup_by']) ?? DateTime.now(),
        createdAt: _dt(j['created_at']), safetyNotes: j['safety_notes'], photoPath: j['photo_path'],
        donorName: j['donor_name'], distanceKm: _d(j['distance_km']),
      );
  int get available => (quantity - qtyReserved).clamp(0, quantity);
  /// Same rule as the website: an "active" listing past its deadline is shown as expired.
  String get effectiveStatus => status == 'active' && pickupBy.isBefore(DateTime.now()) ? 'expired' : status;
  bool get requestable => status == 'active' && pickupBy.isAfter(DateTime.now()) && available > 0;
}

class FoodRequest {
  final String id, listingId, ngoOrgId, status;
  final String? repId, repName, repPhone;
  final int quantity;
  final DateTime? createdAt, completedAt;
  /// Delivery-app style steps: assigned -> on_the_way -> arrived -> collected -> delivered
  String tripStatus;
  DateTime? eta, tripStartedAt, arrivedAt, collectedAt, deliveredAt, tripUpdatedAt;
  Listing? listing;
  Organization? ngo, donor;
  FoodRequest({
    required this.id, required this.listingId, required this.ngoOrgId, required this.status, required this.quantity,
    this.repId, this.repName, this.repPhone, this.createdAt, this.completedAt,
    this.tripStatus = 'assigned', this.eta, this.tripStartedAt, this.arrivedAt, this.collectedAt, this.deliveredAt, this.tripUpdatedAt,
  });
  factory FoodRequest.fromJson(Map<String, dynamic> j) => FoodRequest(
        id: j['id'], listingId: j['listing_id'], ngoOrgId: j['ngo_org_id'], status: j['status'] ?? 'pending',
        quantity: _i(j['quantity']), repId: j['rep_id'], repName: j['rep_name'], repPhone: j['rep_phone'],
        createdAt: _dt(j['created_at']), completedAt: _dt(j['completed_at']),
        tripStatus: j['trip_status'] ?? 'assigned', eta: _dt(j['eta']), tripStartedAt: _dt(j['trip_started_at']),
        arrivedAt: _dt(j['arrived_at']), collectedAt: _dt(j['collected_at']), deliveredAt: _dt(j['delivered_at']),
        tripUpdatedAt: _dt(j['trip_updated_at']),
      );
  /// Food is moving: accepted and not yet collected, or collected and on the way to the NGO.
  bool get inTransit => status == 'accepted' || (status == 'completed' && tripStatus == 'collected');
  bool get canMessage => const ['pending', 'accepted', 'completed'].contains(status);
}

class PickupOtp {
  final String requestId, otp;
  final DateTime? expiresAt;
  PickupOtp(this.requestId, this.otp, this.expiresAt);
  factory PickupOtp.fromJson(Map<String, dynamic> j) => PickupOtp(j['request_id'], j['otp'], _dt(j['expires_at']));
}

class RepLocation {
  final String requestId;
  final double lat, lng;
  final double? accuracy;
  final DateTime? updatedAt;
  RepLocation(this.requestId, this.lat, this.lng, this.accuracy, this.updatedAt);
  factory RepLocation.fromJson(Map<String, dynamic> j) =>
      RepLocation(j['request_id'], _d(j['lat']) ?? 0, _d(j['lng']) ?? 0, _d(j['accuracy_m']), _dt(j['updated_at']));
}

class Requirement {
  final String id, ngoOrgId, title, status;
  final int quantity;
  final DateTime? neededBy, createdAt;
  String? ngoName;
  Requirement(this.id, this.ngoOrgId, this.title, this.status, this.quantity, this.neededBy, this.createdAt);
  factory Requirement.fromJson(Map<String, dynamic> j) => Requirement(
      j['id'], j['ngo_org_id'], j['title'], j['status'] ?? 'open', _i(j['quantity']), _dt(j['needed_by']), _dt(j['created_at']));
}

class AppNotification {
  final String id, title;
  final String? body;
  final bool read;
  final DateTime createdAt;
  AppNotification(this.id, this.title, this.body, this.read, this.createdAt);
  factory AppNotification.fromJson(Map<String, dynamic> j) =>
      AppNotification(j['id'], j['title'] ?? '', j['body'], j['read'] == true, _dt(j['created_at']) ?? DateTime.now());
}

class ChatMessage {
  final String id, requestId, senderId, body;
  final DateTime createdAt;
  ChatMessage(this.id, this.requestId, this.senderId, this.body, this.createdAt);
  factory ChatMessage.fromJson(Map<String, dynamic> j) =>
      ChatMessage(j['id'], j['request_id'], j['sender_id'], j['body'], _dt(j['created_at']) ?? DateTime.now());
}

class FeedbackItem {
  final String id, userId, category, subject, message, status, appPlatform;
  final String? orgId, screenshotPath, adminResponse, appVersion;
  final int? rating;
  final DateTime? createdAt, respondedAt, updatedAt;
  String? senderName, senderRole, orgName;
  FeedbackItem({
    required this.id, required this.userId, required this.category, required this.subject, required this.message,
    required this.status, required this.appPlatform, this.orgId, this.screenshotPath, this.adminResponse,
    this.appVersion, this.rating, this.createdAt, this.respondedAt, this.updatedAt,
  });
  factory FeedbackItem.fromJson(Map<String, dynamic> j) => FeedbackItem(
        id: j['id'], userId: j['user_id'], category: j['category'], subject: j['subject'], message: j['message'],
        status: j['status'] ?? 'open', appPlatform: j['app_platform'] ?? 'android', orgId: j['org_id'],
        screenshotPath: j['screenshot_path'], adminResponse: j['admin_response'], appVersion: j['app_version'],
        rating: j['rating'] == null ? null : _i(j['rating']), createdAt: _dt(j['created_at']),
        respondedAt: _dt(j['responded_at']), updatedAt: _dt(j['updated_at']),
      );
  String get categoryLabel => Domain.feedbackCategories[category] ?? category;
  String get statusLabel => Domain.feedbackStatuses[status] ?? status;
  bool get unresolved => status == 'open' || status == 'in_review';
}

class BadgeDef {
  final String code, appliesTo, name, metric;
  final int threshold;
  BadgeDef(this.code, this.appliesTo, this.name, this.metric, this.threshold);
  factory BadgeDef.fromJson(Map<String, dynamic> j) => BadgeDef(j['code'], j['applies_to'], j['name'], j['metric'], _i(j['threshold']));
}

class Certificate {
  final String id, title, serial;
  final DateTime? issuedAt;
  Certificate(this.id, this.title, this.serial, this.issuedAt);
  factory Certificate.fromJson(Map<String, dynamic> j) => Certificate(j['id'], j['title'], j['serial'], _dt(j['issued_at']));
}

class LeaderRow {
  final String orgId, name;
  final int donations, units;
  LeaderRow(this.orgId, this.name, this.donations, this.units);
  factory LeaderRow.fromJson(Map<String, dynamic> j) => LeaderRow(j['org_id'], j['name'], _i(j['pickups'] ?? j['donations']), _i(j['units']));
}

class Report {
  final String id, reporterOrg, reportedOrg, reason, status;
  final String? requestId, details, adminNote;
  final DateTime? createdAt;
  Report(this.id, this.reporterOrg, this.reportedOrg, this.reason, this.status, this.requestId, this.details, this.adminNote, this.createdAt);
  factory Report.fromJson(Map<String, dynamic> j) => Report(j['id'], j['reporter_org'], j['reported_org'], j['reason'],
      j['status'] ?? 'open', j['request_id'], j['details'], j['admin_note'], _dt(j['created_at']));
  String get reasonLabel => Domain.reportReasons[reason] ?? reason.replaceAll('_', ' ');
}

class ContactMessage {
  final String id, name, email, message, status;
  final String? subject;
  final DateTime? createdAt;
  ContactMessage(this.id, this.name, this.email, this.message, this.status, this.subject, this.createdAt);
  factory ContactMessage.fromJson(Map<String, dynamic> j) =>
      ContactMessage(j['id'], j['name'], j['email'], j['message'], j['status'] ?? 'new', j['subject'], _dt(j['created_at']));
}

class Faq {
  final String id, question, answer;
  final int sortOrder;
  final bool published;
  Faq(this.id, this.question, this.answer, this.sortOrder, this.published);
  factory Faq.fromJson(Map<String, dynamic> j) => Faq(j['id'], j['question'], j['answer'], _i(j['sort_order']), j['published'] == true);
}

class Testimonial {
  final String id, authorName, quote;
  final String? authorRole;
  final bool published;
  Testimonial(this.id, this.authorName, this.quote, this.authorRole, this.published);
  factory Testimonial.fromJson(Map<String, dynamic> j) =>
      Testimonial(j['id'], j['author_name'], j['quote'], j['author_role'], j['published'] == true);
}

class AuditEntry {
  final String id, action;
  final String? targetTable;
  final Map<String, dynamic> details;
  final DateTime? createdAt;
  AuditEntry(this.id, this.action, this.targetTable, this.details, this.createdAt);
  factory AuditEntry.fromJson(Map<String, dynamic> j) => AuditEntry(j['id'], j['action'], j['target_table'],
      (j['details'] is Map) ? Map<String, dynamic>.from(j['details']) : <String, dynamic>{}, _dt(j['created_at']));
  String get note => (details['note'] ?? details['reason'] ?? '').toString();
}

/// Platform totals from the public_impact() RPC (real counts only).
class PlatformImpact {
  final int donations, units, donors, ngos;
  PlatformImpact(this.donations, this.units, this.donors, this.ngos);
  factory PlatformImpact.fromJson(Map<String, dynamic> j) =>
      PlatformImpact(_i(j['donations']), _i(j['units']), _i(j['donors']), _i(j['ngos']));
}
