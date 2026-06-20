/**
 * Service Index - Export tất cả API services
 * 
 * Khi kết nối backend Node.js/MySQL thật, chỉ cần thay đổi 
 * implementation bên trong mỗi service file.
 * 
 * Cấu trúc API endpoints tương ứng:
 * 
 * POST   /api/auth/login          → authService.loginApi()
 * POST   /api/auth/logout         → authService.logoutApi()
 * PUT    /api/auth/change-password → authService.changePasswordApi()
 * 
 * GET    /api/users               → userService.getUsers()
 * POST   /api/users               → userService.createUser()
 * PUT    /api/users/:id           → userService.updateUser()
 * PUT    /api/users/:id/role      → userService.changeRole()
 * PUT    /api/users/:id/deactivate → userService.deactivateUser()
 * 
 * GET    /api/equipment           → equipmentService.getEquipment()
 * POST   /api/equipment           → equipmentService.createEquipment()
 * PUT    /api/equipment/:id/deactivate → equipmentService.deactivateEquipment()
 * 
 * GET    /api/inventory           → equipmentService.getInventory()
 * 
 * GET    /api/imports             → equipmentService.getImports()
 * POST   /api/imports             → equipmentService.createImport()
 * 
 * GET    /api/suppliers           → catalogService.getSuppliers()
 * POST   /api/suppliers           → catalogService.createSupplier()
 * PUT    /api/suppliers/:id       → catalogService.updateSupplier()
 * 
 * GET    /api/departments         → catalogService.getDepartments()
 * POST   /api/departments         → catalogService.createDepartment()
 * PUT    /api/departments/:id     → catalogService.updateDepartment()
 * 
 * GET    /api/requests            → requestService.getRequests()
 * POST   /api/requests            → requestService.createRequest()
 * PUT    /api/requests/:id/approve-dept → requestService.approveByDeptHead()
 * PUT    /api/requests/:id/approve-mgr  → requestService.approveByManager()
 * POST   /api/requests/:id/process      → requestService.processExport()
 * PUT    /api/requests/:id/confirm      → requestService.confirmReceived()
 * 
 * POST   /api/exports             → requestService.createExport()
 * PUT    /api/exports/:id/confirm → requestService.confirmExport()
 * 
 * GET    /api/damage-reports      → reportService.getDamageReports()
 * POST   /api/damage-reports      → reportService.createDamageReport()
 * PUT    /api/damage-reports/:id/resolve → reportService.resolveDamageReport()
 * 
 * GET    /api/notifications       → reportService.getNotifications()
 * PUT    /api/notifications/:id/read    → reportService.markAsRead()
 * PUT    /api/notifications/read-all    → reportService.markAllAsRead()
 */

export * from './authService';
export * from './userService';
export * from './equipmentService';
export * from './requestService';
export * from './catalogService';
export * from './reportService';
