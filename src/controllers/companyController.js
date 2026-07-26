import asyncHandler from 'express-async-handler';
import Company from '../models/Company.js';

// @desc    List companies — search, status filter, paginate
// @route   GET /api/companies?search=&status=&page=&perPage=
// @access  Private
export const getCompanies = asyncHandler(async (req, res) => {
  const { search = '', status = 'all', page = 1, perPage = 6 } = req.query;

  const filter = {};
  if (status !== 'all') filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { contact: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const perPageNum = Math.max(1, parseInt(perPage, 10) || 6);

  const [total, companies] = await Promise.all([
    Company.countDocuments(filter),
    Company.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * perPageNum)
      .limit(perPageNum),
  ]);

  res.json({
    success: true,
    data: companies,
    pagination: {
      total,
      page: pageNum,
      perPage: perPageNum,
      totalPages: Math.ceil(total / perPageNum),
    },
  });
});

// @desc    Get a single company
// @route   GET /api/companies/:id
// @access  Private
export const getCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }
  res.json({ success: true, data: company });
});

// @desc    Create a company
// @route   POST /api/companies
// @access  Private (admin, dispatcher) — ASSUMPTION: mirrors shipment/courier create permissions
export const createCompany = asyncHandler(async (req, res) => {
  const { name, contact, email, phone, address, status, plan } = req.body;

  if (!name || !contact || !email) {
    res.status(400);
    throw new Error('name, contact, and email are required');
  }

  const company = await Company.create({ name, contact, email, phone, address, status, plan });
  res.status(201).json({ success: true, data: company });
});

// @desc    Update editable company fields
// @route   PATCH /api/companies/:id
// @access  Private (admin, dispatcher)
export const updateCompany = asyncHandler(async (req, res) => {
  const { name, contact, email, phone, address, plan } = req.body;

  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  if (name !== undefined) company.name = name;
  if (contact !== undefined) company.contact = contact;
  if (email !== undefined) company.email = email;
  if (phone !== undefined) company.phone = phone;
  if (address !== undefined) company.address = address;
  if (plan !== undefined) company.plan = plan;

  await company.save();
  res.json({ success: true, data: company });
});

// @desc    Update company status (active / pending / suspended)
// @route   PATCH /api/companies/:id/status
// @access  Private (admin, dispatcher)
export const updateCompanyStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const ALLOWED = ['active', 'pending', 'suspended'];

  if (!ALLOWED.includes(status)) {
    res.status(400);
    throw new Error(`status must be one of: ${ALLOWED.join(', ')}`);
  }

  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }

  company.status = status;
  await company.save();
  res.json({ success: true, data: company });
});

// @desc    Delete a company
// @route   DELETE /api/companies/:id
// @access  Private (admin only)
export const deleteCompany = asyncHandler(async (req, res) => {
  const company = await Company.findById(req.params.id);
  if (!company) {
    res.status(404);
    throw new Error('Company not found');
  }
  await company.deleteOne();
  res.json({ success: true, data: {} });
});