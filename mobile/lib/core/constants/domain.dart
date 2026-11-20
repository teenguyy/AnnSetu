/// Domain vocabulary shared with the website (website/src/lib.js) and enforced by the database.
class Domain {
  static const categories = ['Cooked meals', 'Bakery', 'Packaged food', 'Fruits & vegetables', 'Dairy'];
  static const units = ['portions', 'kg', 'packs'];
  static const donorTypes = ['Restaurant', 'Hotel', 'Canteen', 'Event organiser', 'Food business', 'Community kitchen'];
  static const ngoTypes = ['NGO', 'Shelter', 'Community kitchen', 'Orphanage', 'Old-age home', 'Community group'];
  static const docTypes = <String, String>{
    'registration': 'Organisation registration',
    'fssai': 'FSSAI licence',
    'tax': '12A / 80G certificate',
    'id': 'Authorised person ID',
    'other': 'Other proof',
  };
  static const reportReasons = <String, String>{
    'unsafe_food': 'Unsafe or spoiled food',
    'no_show': 'No-show at pickup',
    'misconduct': 'Misconduct',
    'fake_organisation': 'Looks like a fake organisation',
    'other': 'Something else',
  };
  static const feedbackCategories = <String, String>{
    'general': 'General feedback',
    'bug': 'Bug report',
    'feature': 'Feature request',
    'account': 'Account issue',
    'donation': 'Donation issue',
    'pickup': 'Pickup issue',
    'other': 'Other',
  };
  static const feedbackStatuses = <String, String>{
    'open': 'Open',
    'in_review': 'In review',
    'resolved': 'Resolved',
    'closed': 'Closed',
  };

  /// Average meal weight used by WRAP (UK) for "meal equivalents": 420 g.
  static const kgPerMeal = 0.42;
}

enum Role { donor, ngo, rep, admin }

Role? roleFrom(String? s) => switch (s) { 'donor' => Role.donor, 'ngo' => Role.ngo, 'rep' => Role.rep, 'admin' => Role.admin, _ => null };
String roleLabel(Role r) => switch (r) { Role.donor => 'Donor', Role.ngo => 'Receiver', Role.rep => 'Representative', Role.admin => 'Administrator' };

/// Types that may ask for review without a registration certificate (same rule as the database).
const noCertTypes = ['NGO', 'Community group', 'Community kitchen'];
