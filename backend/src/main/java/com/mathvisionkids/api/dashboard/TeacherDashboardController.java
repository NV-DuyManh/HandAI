package com.mathvisionkids.api.dashboard;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.Principal;

@RestController
@RequestMapping("/api/v1/teacher/dashboard")
public class TeacherDashboardController {

    private final DashboardService dashboardService;

    public TeacherDashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public ResponseEntity<DashboardResponse> getDashboard(Principal principal) {
        return ResponseEntity.ok(dashboardService.getDashboard(principal.getName()));
    }
}
