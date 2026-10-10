// Mock data and authentication logic

const STORAGE_KEY = 'texflow_mockdata';

const initialData = {
  organisations: [
    {
      companyId: 'TXF-100001',
      companyName: 'Alpha Textiles',
      ownerName: 'Alice Smith',
      ownerEmail: 'alice@alphatextiles.com',
      password: 'password123',
      status: 'ACTIVE'
    },
    {
      companyId: 'TXF-100002',
      companyName: 'Beta Fabrics',
      ownerName: 'Bob Jones',
      ownerEmail: 'bob@betafabrics.com',
      password: 'password123',
      status: 'ACTIVE'
    }
  ],
  staff: [
    {
      employeeId: 'EMP-001',
      companyId: 'TXF-100001',
      fullName: 'Charlie Davis',
      email: 'charlie@alphatextiles.com',
      role: 'Production Manager',
      password: 'password123',
      status: 'ACTIVE'
    }
  ],
  buyers: [
    {
      buyerId: 'BUY-001',
      companyId: 'TXF-100001',
      buyerName: 'David Lee',
      email: 'david@retailer.com',
      password: 'password123',
      status: 'ACTIVE',
      role: 'Buyer'
    }
  ]
};

function getData() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : initialData;
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function findOrganisationByCompanyId(companyId) {
  const data = getData();
  return data.organisations.find(org => org.companyId === companyId);
}

export function registerOrganisation(orgData) {
  const data = getData();
  
  if (data.organisations.some(org => org.ownerEmail === orgData.ownerEmail)) {
    throw new Error('Email already registered as an organisation owner.');
  }

  const companyId = 'TXF-' + Math.floor(100000 + Math.random() * 900000);
  const newOrg = { ...orgData, companyId, status: 'ACTIVE' };
  
  data.organisations.push(newOrg);
  saveData(data);
  return newOrg;
}

export function authenticateOrganisation(companyId, email, password) {
  const data = getData();
  const org = data.organisations.find(
    org => org.companyId === companyId && org.ownerEmail === email
  );
  
  if (!org) throw new Error('Organisation not found or incorrect email.');
  if (org.password !== password) throw new Error('Incorrect password.');
  if (org.status !== 'ACTIVE') throw new Error('Account is not active.');
  
  return { ...org, role: 'OWNER' };
}

export function authenticateStaff(companyId, emailOrId, password, role) {
  const data = getData();
  const staff = data.staff.find(
    s => s.companyId === companyId && 
         (s.email === emailOrId || s.employeeId === emailOrId)
  );

  if (!staff) throw new Error('Staff account not found.');
  if (staff.role !== role) throw new Error(`Account role mismatch. Expected ${role}.`);
  if (staff.password !== password) throw new Error('Incorrect password.');
  if (staff.status !== 'ACTIVE') throw new Error('Account is not active.');

  return staff;
}

export function authenticateBuyer(companyId, emailOrId, password) {
  const data = getData();
  const buyer = data.buyers.find(
    b => b.companyId === companyId && 
         (b.email === emailOrId || b.buyerId === emailOrId)
  );

  if (!buyer) throw new Error('Buyer account not found.');
  if (buyer.password !== password) throw new Error('Incorrect password.');
  if (buyer.status !== 'ACTIVE') throw new Error('Account is not active.');

  return buyer;
}

// Simulated OTP reset flow
let resetSessions = {};

export function requestPasswordReset(accountType, companyId, email, role) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const data = getData();
      let account;
      if (accountType === 'Organisation') {
        account = data.organisations.find(o => o.companyId === companyId && o.ownerEmail === email);
      } else if (role === 'Buyer') {
        account = data.buyers.find(b => b.companyId === companyId && b.email === email);
      } else {
        account = data.staff.find(s => s.companyId === companyId && s.email === email && s.role === role);
      }

      if (!account) {
        return reject(new Error('Account not found with provided details.'));
      }

      const otp = '123456'; // Mock OTP
      const sessionId = Date.now().toString();
      resetSessions[sessionId] = { accountType, companyId, email, role, otp, verified: false };
      
      resolve({ sessionId, message: 'OTP sent (mock)' });
    }, 500);
  });
}

export function verifyResetOTP(sessionId, otp) {
  const session = resetSessions[sessionId];
  if (!session) throw new Error('Invalid or expired session.');
  if (session.otp !== otp) throw new Error('Incorrect OTP.');
  
  session.verified = true;
  return true;
}

export function resetPassword(sessionId, newPassword) {
  const session = resetSessions[sessionId];
  if (!session || !session.verified) throw new Error('Unverified session.');

  const data = getData();
  if (session.accountType === 'Organisation') {
    const org = data.organisations.find(o => o.companyId === session.companyId && o.ownerEmail === session.email);
    if (org) org.password = newPassword;
  } else if (session.role === 'Buyer') {
    const buyer = data.buyers.find(b => b.companyId === session.companyId && b.email === session.email);
    if (buyer) buyer.password = newPassword;
  } else {
    const staff = data.staff.find(s => s.companyId === session.companyId && s.email === session.email && s.role === session.role);
    if (staff) staff.password = newPassword;
  }

  saveData(data);
  delete resetSessions[sessionId];
  return true;
}
